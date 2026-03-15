import {
  App,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TAbstractFile,
  TFile,
  TFolder,
  requestUrl
} from "obsidian";

type RunTrigger = "manual" | "startup" | "schedule" | "watch";

type UpdateMode = "skip" | "overwrite" | "append";

type ImageMode = "off" | "remote" | "download";

interface PluginSettings {
  logFilePath: string;
  rssUrl: string;
  rssLastResponsePath: string;
  rssRootFolder: string;
  rssPathTemplate: string;
  rssFileNameTemplate: string;
  rssUpdateMode: UpdateMode;
  rssTrimCommands: boolean;
  rssSanitizeXml: boolean;
  rssImageMode: ImageMode;
  rssImageNameTemplate: string;
  rssImageDeduplicate: boolean;
  rssAssetsFolder: string;
  rssPullOnStartup: boolean;
  rssScheduleEnabled: boolean;
  rssScheduleIntervalMinutes: number;
  rssWatchEnabled: boolean;
  rssWatchFolder: string;
  rssProcessedFolder: string;
  rssMissingGroupFolder: string;
}

const DEFAULT_SETTINGS: PluginSettings = {
  logFilePath: "log.md",
  rssUrl: "",
  rssLastResponsePath: "rss-last.xml",
  rssRootFolder: "000 Metaverse",
  rssPathTemplate: "{root}/{type}/{name}/P{p_group}",
  rssFileNameTemplate: "{title} ({id})",
  rssUpdateMode: "overwrite",
  rssTrimCommands: false,
  rssSanitizeXml: true,
  rssImageMode: "remote",
  rssImageNameTemplate: "{name} - {p_code} - {id} - {index}",
  rssImageDeduplicate: true,
  rssAssetsFolder: "assets/rss",
  rssPullOnStartup: false,
  rssScheduleEnabled: false,
  rssScheduleIntervalMinutes: 60,
  rssWatchEnabled: false,
  rssWatchFolder: "tmpMK/rss-inbox",
  rssProcessedFolder: "tmpMK/rss-processed",
  rssMissingGroupFolder: "misc"
};

interface RssItem {
  title: string;
  description: string;
  link: string;
  guid: string;
  pubDate: string;
  mediaUrls: string[];
}

interface ParsedDescription {
  frontmatter: string | null;
  body: string;
  fields: Record<string, string>;
}

interface SectionInfo {
  code: string;
  group: string;
  label: string;
}

interface MediaContext {
  name: string;
  type: string;
  pCode: string;
  pGroup: string;
  section: string;
  title: string;
  id: string;
}

interface RssStats {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  createdFolders: number;
  mediaDownloaded: number;
}

export default class MkImportRssPlugin extends Plugin {
  settings: PluginSettings;
  private rssScheduleId: number | null = null;
  private rssRunning = false;
  private rssProcessing = new Set<string>();
  private mediaIndex: Record<string, string> = {};
  private mediaIndexDirty = false;

  async onload() {
    await this.loadSettings();

    this.addCommand({
      id: "mk-import-rss-pull",
      name: "Import RSS now",
      callback: () => {
        this.runRssPull("manual");
      }
    });

    this.addCommand({
      id: "mk-import-rss-inbox",
      name: "Process RSS inbox now",
      callback: () => {
        this.runRssInbox("manual");
      }
    });

    this.addRibbonIcon("rss", "Import RSS now", () => {
      this.runRssPull("manual");
    });

    this.addSettingTab(new MkImportRssSettingTab(this.app, this));

    this.resetRssSchedule();

    this.registerEvent(
      this.app.vault.on("create", (file) => {
        this.handleRssWatchCreate(file);
      })
    );

    if (this.settings.rssPullOnStartup) {
      this.app.workspace.onLayoutReady(() => {
        this.runRssPull("startup");
      });
    }
  }

  onunload() {
    this.clearRssSchedule();
  }

  async loadSettings() {
    const data = await this.loadData();
    const record = data as
      | { settings?: Partial<PluginSettings>; mediaIndex?: Record<string, string> }
      | null;

    if (record && typeof record === "object" && record.settings) {
      this.settings = Object.assign({}, DEFAULT_SETTINGS, record.settings);
      this.mediaIndex = record.mediaIndex ?? {};
      return;
    }

    this.settings = Object.assign({}, DEFAULT_SETTINGS, data ?? {});
    this.mediaIndex = {};
  }

  async saveSettings() {
    await this.saveData({ settings: this.settings, mediaIndex: this.mediaIndex });
  }

  resetRssSchedule() {
    this.clearRssSchedule();

    if (!this.settings.rssScheduleEnabled) {
      return;
    }

    const minutes = Math.max(1, this.settings.rssScheduleIntervalMinutes);
    const intervalMs = minutes * 60 * 1000;

    this.rssScheduleId = window.setInterval(() => {
      this.runRssPull("schedule");
    }, intervalMs);

    this.registerInterval(this.rssScheduleId);
  }

  private clearRssSchedule() {
    if (this.rssScheduleId !== null) {
      window.clearInterval(this.rssScheduleId);
      this.rssScheduleId = null;
    }
  }

  private formatTimestamp(date: Date): string {
    const pad = (value: number) => value.toString().padStart(2, "0");
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  private formatError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === "string") {
      return error;
    }
    return String(error);
  }

  private async appendLog(message: string) {
    const logPath = this.settings.logFilePath.trim();
    if (!logPath) {
      console.warn("Log file path is empty. Message:", message);
      return;
    }

    const timestamp = this.formatTimestamp(new Date());
    const line = `\n- [${timestamp}] ${message}`;

    try {
      const abstract = this.app.vault.getAbstractFileByPath(logPath);
      if (!abstract) {
        await this.app.vault.create(logPath, `# Move log${line}`);
        return;
      }

      if (!(abstract instanceof TFile)) {
        console.error(`Log path is not a file: ${logPath}`);
        return;
      }

      const content = await this.app.vault.read(abstract);
      await this.app.vault.modify(abstract, content + line);
    } catch (error) {
      console.error("Failed to write log file", error);
    }
  }

  private markMediaIndexDirty() {
    this.mediaIndexDirty = true;
  }

  private async flushMediaIndex() {
    if (!this.mediaIndexDirty) {
      return;
    }
    try {
      await this.saveSettings();
      this.mediaIndexDirty = false;
    } catch (error) {
      console.error("Failed to persist media index", error);
    }
  }

  private async saveLastRssResponse(xml: string) {
    const responsePath = this.normalizePath(this.settings.rssLastResponsePath);
    if (!responsePath) {
      return;
    }

    try {
      const parent = this.getParentFolderPath(responsePath);
      if (parent) {
        await this.ensureFolder(parent);
      }

      const existing = this.app.vault.getAbstractFileByPath(responsePath);
      if (existing instanceof TFile) {
        await this.app.vault.modify(existing, xml);
      } else if (!existing) {
        await this.app.vault.create(responsePath, xml);
      } else {
        await this.appendLog(
          `ERROR: RSS last response path is not a file: ${responsePath}`
        );
        return;
      }

      await this.appendLog(`RSS response saved to ${responsePath}`);
    } catch (error) {
      await this.appendLog(
        `ERROR: failed to save RSS response. ${this.formatError(error)}`
      );
    }
  }

  private async handleRssWatchCreate(file: TAbstractFile) {
    if (!this.settings.rssWatchEnabled) {
      return;
    }

    if (!(file instanceof TFile) || file.extension !== "xml") {
      return;
    }

    const watchFolder = this.normalizePath(this.settings.rssWatchFolder);
    if (!watchFolder) {
      return;
    }

    if (!file.parent || this.normalizePath(file.parent.path) !== watchFolder) {
      return;
    }

    if (this.rssProcessing.has(file.path)) {
      return;
    }

    this.rssProcessing.add(file.path);
    try {
      await this.processRssFile(file, "watch");
    } finally {
      this.rssProcessing.delete(file.path);
    }
  }

  async runRssPull(trigger: RunTrigger) {
    if (this.rssRunning) {
      await this.appendLog("RSS pull skipped: another run is active.");
      return;
    }

    const url = this.settings.rssUrl.trim();
    if (!url) {
      const msg = "ERROR: RSS URL is empty.";
      new Notice(msg);
      await this.appendLog(msg);
      return;
    }

    this.rssRunning = true;
    await this.appendLog(`RSS pull started (${trigger}). URL: ${url}`);

    try {
      const xml = await this.fetchRssXml(url);
      const stats = await this.processRssXml(xml, "pull", trigger);
      const summary =
        `RSS pull summary: total=${stats.total}, created=${stats.created}, ` +
        `updated=${stats.updated}, skipped=${stats.skipped}, ` +
        `foldersCreated=${stats.createdFolders}, errors=${stats.errors}`;
      new Notice(summary);
      await this.appendLog(summary);
    } catch (error) {
      const msg = `ERROR: RSS pull failed. ${this.formatError(error)}`;
      new Notice(msg);
      await this.appendLog(msg);
    } finally {
      this.rssRunning = false;
    }
  }

  async runRssInbox(trigger: RunTrigger) {
    const watchFolderPath = this.normalizePath(this.settings.rssWatchFolder);
    if (!watchFolderPath) {
      const msg = "ERROR: RSS watch folder is empty.";
      new Notice(msg);
      await this.appendLog(msg);
      return;
    }

    const folder = this.app.vault.getAbstractFileByPath(watchFolderPath);
    if (!(folder instanceof TFolder)) {
      const msg = `ERROR: RSS watch folder not found: ${watchFolderPath}`;
      new Notice(msg);
      await this.appendLog(msg);
      return;
    }

    const xmlFiles = folder.children.filter(
      (child): child is TFile =>
        child instanceof TFile && child.extension === "xml"
    );

    if (xmlFiles.length === 0) {
      const msg = "RSS inbox: no XML files found.";
      new Notice(msg);
      await this.appendLog(msg);
      return;
    }

    await this.appendLog(
      `RSS inbox processing started (${trigger}). Files: ${xmlFiles.length}`
    );

    for (const file of xmlFiles) {
      await this.processRssFile(file, trigger);
    }
  }

  private async processRssFile(file: TFile, trigger: RunTrigger) {
    try {
      const xml = await this.app.vault.read(file);
      const stats = await this.processRssXml(xml, "inbox", trigger);
      const summary =
        `RSS inbox summary (${file.name}): total=${stats.total}, ` +
        `created=${stats.created}, updated=${stats.updated}, ` +
        `skipped=${stats.skipped}, foldersCreated=${stats.createdFolders}, ` +
        `errors=${stats.errors}`;
      await this.appendLog(summary);
    } catch (error) {
      const msg = `ERROR: failed to process RSS inbox file ${file.path}. ${this.formatError(error)}`;
      new Notice(msg);
      await this.appendLog(msg);
      return;
    }

    const processedFolderPath = this.normalizePath(
      this.settings.rssProcessedFolder
    );
    if (!processedFolderPath) {
      return;
    }

    try {
      await this.ensureFolder(processedFolderPath);
      const destinationPath = `${processedFolderPath}/${file.name}`;
      await this.app.fileManager.renameFile(file, destinationPath);
      await this.appendLog(`RSS inbox file moved to ${destinationPath}`);
    } catch (error) {
      const msg = `ERROR: failed to move RSS inbox file ${file.path}. ${this.formatError(error)}`;
      await this.appendLog(msg);
    }
  }

  private async fetchRssXml(url: string): Promise<string> {
    const response = await requestUrl({ url, method: "GET" });
    const xml = response.text;
    await this.saveLastRssResponse(xml);
    return xml;
  }

  private async processRssXml(
    xml: string,
    source: string,
    trigger: RunTrigger
  ): Promise<RssStats> {
    const stats: RssStats = {
      total: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      createdFolders: 0,
      mediaDownloaded: 0
    };

    const workingXml = this.settings.rssSanitizeXml
      ? this.sanitizeXml(xml)
      : xml;
    let items: RssItem[];

    try {
      items = this.parseRssItems(workingXml);
    } catch (error) {
      const fallbackItems = this.parseRssItemsLenient(workingXml);
      if (fallbackItems.length > 0) {
        await this.appendLog(
          `RSS parse failed, using lenient parser. Items: ${fallbackItems.length}.`
        );
        items = fallbackItems;
      } else {
        const snippet = this.buildSnippet(xml, 500);
        await this.appendLog(
          `ERROR: RSS parse failed. ${this.formatError(error)}. Snippet: ${snippet}`
        );
        throw error;
      }
    }
    if (items.length === 0) {
      await this.appendLog(`RSS ${source}: no items found.`);
      await this.flushMediaIndex();
      return stats;
    }

    for (const item of items) {
      stats.total++;
      const result = await this.writeRssItem(item, trigger, stats);
      if (result === "created") {
        stats.created++;
      } else if (result === "updated") {
        stats.updated++;
      } else if (result === "skipped") {
        stats.skipped++;
      } else {
        stats.errors++;
      }
    }

    await this.appendLog(
      `RSS ${source} run finished (${trigger}). Items: ${items.length}.`
    );

    await this.flushMediaIndex();
    return stats;
  }

  private parseRssItems(xml: string): RssItem[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "text/xml");

    if (doc.getElementsByTagName("parsererror").length > 0) {
      throw new Error("Failed to parse RSS XML.");
    }

    const items = Array.from(doc.getElementsByTagName("item"));
    return items.map((item) => {
      const title = this.getElementText(item, "title");
      const description = this.getElementText(item, "description");
      const link = this.getElementText(item, "link");
      const guid = this.getElementText(item, "guid");
      const pubDate = this.getElementText(item, "pubDate");
      const mediaUrls = this.extractMediaUrls(item);

      return {
        title,
        description,
        link,
        guid,
        pubDate,
        mediaUrls
      };
    });
  }

  private parseRssItemsLenient(xml: string): RssItem[] {
    const items: RssItem[] = [];
    const itemRegex = /<item\b[^>]*>[\s\S]*?<\/item>/gi;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(xml)) !== null) {
      const block = match[0];
      const title = this.extractTagValue(block, "title");
      const description = this.extractTagValue(block, "description");
      const link = this.extractTagValue(block, "link");
      const guid = this.extractTagValue(block, "guid");
      const pubDate = this.extractTagValue(block, "pubDate");
      const mediaUrls = this.extractMediaUrlsLenient(block);

      items.push({
        title,
        description,
        link,
        guid,
        pubDate,
        mediaUrls
      });
    }

    return items;
  }

  private extractTagValue(xml: string, tag: string): string {
    const regex = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
    const match = regex.exec(xml);
    if (!match) {
      return "";
    }
    const raw = this.stripCdata(match[1]);
    return this.decodeBasicEntities(raw).replace(/\r\n/g, "\n").trim();
  }

  private stripCdata(value: string): string {
    return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  }

  private decodeBasicEntities(value: string): string {
    return value
      .replace(/&nbsp;/gi, " ")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, "\"")
      .replace(/&apos;/gi, "'")
      .replace(/&amp;/gi, "&");
  }

  private extractMediaUrlsLenient(xml: string): string[] {
    const urls: string[] = [];
    const mediaRegex = /<media:content\b[^>]*\burl=["']([^"']+)["'][^>]*>/gi;
    let match: RegExpExecArray | null;

    while ((match = mediaRegex.exec(xml)) !== null) {
      urls.push(match[1]);
    }

    return urls;
  }

  private getElementText(parent: ParentNode, tag: string): string {
    const element = parent.getElementsByTagName(tag)[0];
    if (!element || element.textContent === null) {
      return "";
    }
    return element.textContent.replace(/\r\n/g, "\n").trim();
  }

  private extractMediaUrls(parent: ParentNode): string[] {
    const mediaElements = Array.from(
      parent.getElementsByTagName("media:content")
    );
    const urls: string[] = [];

    for (const media of mediaElements) {
      const url = media.getAttribute("url");
      if (url) {
        urls.push(url);
      }
    }

    return urls;
  }

  private async writeRssItem(
    item: RssItem,
    trigger: RunTrigger,
    stats: RssStats
  ): Promise<"created" | "updated" | "skipped" | "error"> {
    const itemId = this.extractItemId(item.guid) || this.extractItemId(item.link);
    const parsedDescription = this.parseDescription(item.description);

    let typeValue = parsedDescription.fields.type || "";
    let nameValue = parsedDescription.fields.name || "";

    if (!nameValue && item.title.includes(" - ")) {
      nameValue = item.title.split(" - ")[0]?.trim() ?? "";
    }

    if (!typeValue) {
      typeValue = "unknown";
    }
    if (!nameValue) {
      nameValue = "unknown";
    }

    const section = this.parseSectionInfo(item.title);
    const pGroup = section.group || this.settings.rssMissingGroupFolder;

    const templateVars = {
      root: this.normalizePath(this.settings.rssRootFolder),
      type: this.sanitizePathSegment(typeValue),
      name: this.sanitizePathSegment(nameValue),
      p_group: this.sanitizePathSegment(pGroup),
      p_code: this.sanitizePathSegment(section.code),
      section: this.sanitizePathSegment(section.label),
      title: this.sanitizePathSegment(item.title),
      id: this.sanitizePathSegment(itemId)
    };

    const resolvedFolder = this.resolveTemplate(
      this.settings.rssPathTemplate,
      templateVars
    );
    const folderPath = this.normalizePath(resolvedFolder);

    if (!folderPath) {
      await this.appendLog("ERROR: RSS target folder resolved to empty path.");
      return "error";
    }

    try {
      const created = await this.ensureFolder(folderPath);
      if (created) {
        stats.createdFolders++;
      }
    } catch (error) {
      await this.appendLog(
        `ERROR: cannot create RSS folder ${folderPath}. ${this.formatError(error)}`
      );
      return "error";
    }

    let fileBase = this.resolveTemplate(
      this.settings.rssFileNameTemplate,
      templateVars
    ).trim();

    fileBase = this.sanitizePathSegment(fileBase);

    if (!fileBase) {
      fileBase = itemId ? `item-${itemId}` : `item-${Date.now()}`;
    }

    if (!fileBase.toLowerCase().endsWith(".md")) {
      fileBase += ".md";
    }

    const filePath = `${folderPath}/${fileBase}`;

    const mediaContext: MediaContext = {
      name: nameValue,
      type: typeValue,
      pCode: section.code,
      pGroup: pGroup,
      section: section.label,
      title: item.title,
      id: itemId || ""
    };

    const noteContent = await this.buildRssNoteContent(
      item,
      parsedDescription,
      mediaContext
    );

    const existing = this.app.vault.getAbstractFileByPath(filePath);
    if (existing) {
      if (!(existing instanceof TFile)) {
        await this.appendLog(
          `ERROR: RSS target path is not a file: ${filePath}`
        );
        return "error";
      }

      if (this.settings.rssUpdateMode === "skip") {
        await this.appendLog(`RSS skipped (exists): ${filePath}`);
        return "skipped";
      }

      if (this.settings.rssUpdateMode === "append") {
        const current = await this.app.vault.read(existing);
        const combined = `${current}\n\n---\n\n${noteContent}`;
        await this.app.vault.modify(existing, combined);
        await this.appendLog(`RSS appended: ${filePath}`);
        return "updated";
      }

      await this.app.vault.modify(existing, noteContent);
      await this.appendLog(`RSS updated: ${filePath}`);
      return "updated";
    }

    try {
      await this.app.vault.create(filePath, noteContent);
      await this.appendLog(`RSS created: ${filePath}`);
      return "created";
    } catch (error) {
      await this.appendLog(
        `ERROR: cannot create RSS file ${filePath}. ${this.formatError(error)}`
      );
      return "error";
    }
  }

  private parseDescription(description: string): ParsedDescription {
    const normalized = description.replace(/\r\n/g, "\n").trim();
    const match = normalized.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);

    if (!match) {
      return {
        frontmatter: null,
        body: normalized,
        fields: {}
      };
    }

    const frontmatter = match[1];
    const body = normalized.slice(match[0].length);
    const fields = this.parseFrontmatterFields(frontmatter);

    return {
      frontmatter,
      body,
      fields
    };
  }

  private parseFrontmatterFields(frontmatter: string): Record<string, string> {
    const fields: Record<string, string> = {};

    for (const line of frontmatter.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const colonIndex = trimmed.indexOf(":");
      if (colonIndex <= 0) {
        continue;
      }

      const key = trimmed.slice(0, colonIndex).trim();
      let value = trimmed.slice(colonIndex + 1).trim();
      value = value.replace(/^"|"$/g, "");
      value = value.replace(/^'|'$/g, "");

      if (key && value) {
        fields[key] = value;
      }
    }

    return fields;
  }

  private parseSectionInfo(title: string): SectionInfo {
    const match = title.match(/[ПP]\[(\d+)-(\d+)\]/i);
    if (!match) {
      return {
        code: "",
        group: "",
        label: title.trim()
      };
    }

    return {
      code: match[0],
      group: match[1],
      label: title.replace(match[0], "").trim()
    };
  }

  private extractItemId(value: string): string {
    const match = value.match(/\/(\d+)\/?$/);
    if (!match) {
      return "";
    }
    return match[1];
  }

  private async buildRssNoteContent(
    item: RssItem,
    parsed: ParsedDescription,
    mediaContext: MediaContext
  ): Promise<string> {
    let body = parsed.body;
    if (this.settings.rssTrimCommands) {
      body = this.trimServiceLines(body);
    }

    const importedAt = new Date().toISOString();
    const pubDate = this.normalizePubDate(item.pubDate);

    const mkFields: Record<string, string | string[]> = {
      mk_guid: item.guid,
      mk_link: item.link,
      mk_pubDate: pubDate,
      mk_source: "rss",
      mk_imported: importedAt
    };

    const itemId = this.extractItemId(item.guid) || this.extractItemId(item.link);
    if (itemId) {
      mkFields.mk_id = itemId;
    }

    if (item.mediaUrls.length > 0) {
      mkFields.mk_media = item.mediaUrls;
    }

    const frontmatter = this.mergeFrontmatter(parsed.frontmatter, mkFields);

    let mediaEmbeds: string[] = [];
    if (this.settings.rssImageMode !== "off") {
      mediaEmbeds = await this.resolveMediaEmbeds(item, mediaContext);
    }

    if (mediaEmbeds.length > 0) {
      const existing = mediaEmbeds.filter((embed) => !body.includes(embed));
      if (existing.length > 0) {
        body = `${body}\n\n${existing.join("\n")}`.trim();
      }
    }

    const finalBody = body.trim();

    if (!frontmatter) {
      return finalBody;
    }

    if (!finalBody) {
      return frontmatter;
    }

    return `${frontmatter}\n${finalBody}`;
  }

  private trimServiceLines(content: string): string {
    const lines = content.split("\n");
    const filtered = lines.filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return true;
      }
      if (trimmed === "_______") {
        return false;
      }
      if (trimmed.startsWith("/menu") || trimmed.startsWith("/mean")) {
        return false;
      }
      return true;
    });

    return filtered.join("\n");
  }

  private normalizePubDate(pubDate: string): string {
    if (!pubDate) {
      return "";
    }

    const parsed = new Date(pubDate);
    if (Number.isNaN(parsed.getTime())) {
      return pubDate;
    }

    return parsed.toISOString();
  }

  private mergeFrontmatter(
    existing: string | null,
    mkFields: Record<string, string | string[]>
  ): string {
    const existingLines = existing ? existing.split("\n") : [];
    const cleaned = this.stripMkFields(existingLines);
    const mkLines = this.buildMkLines(mkFields);

    const combined = [...cleaned, ...mkLines].filter(
      (line, index, arr) => {
        if (line.trim() !== "") {
          return true;
        }
        const prev = arr[index - 1];
        return prev && prev.trim() !== "";
      }
    );

    if (combined.length === 0) {
      return "";
    }

    return `---\n${combined.join("\n")}\n---`;
  }

  private stripMkFields(lines: string[]): string[] {
    const cleaned: string[] = [];
    let skipIndented = false;

    for (const line of lines) {
      if (skipIndented) {
        if (/^\s+/.test(line)) {
          continue;
        }
        skipIndented = false;
      }

      const trimmed = line.trimStart();
      if (trimmed.startsWith("mk_")) {
        if (/^mk_[^:]+:\s*$/.test(trimmed)) {
          skipIndented = true;
        }
        continue;
      }

      cleaned.push(line);
    }

    return cleaned;
  }

  private buildMkLines(fields: Record<string, string | string[]>): string[] {
    const lines: string[] = [];

    for (const [key, value] of Object.entries(fields)) {
      if (Array.isArray(value)) {
        if (value.length === 0) {
          continue;
        }
        lines.push(`${key}:`);
        for (const entry of value) {
          lines.push(`  - ${this.yamlValue(entry)}`);
        }
        continue;
      }

      if (!value) {
        continue;
      }

      lines.push(`${key}: ${this.yamlValue(value)}`);
    }

    return lines;
  }

  private yamlValue(value: string): string {
    const needsQuotes = /[:#\n\r]/.test(value) ||
      value.startsWith(" ") ||
      value.endsWith(" ");

    if (!needsQuotes) {
      return value;
    }

    return `"${value.replace(/"/g, "\\\"")}"`;
  }

  private async resolveMediaEmbeds(
    item: RssItem,
    context: MediaContext
  ): Promise<string[]> {
    if (item.mediaUrls.length === 0) {
      return [];
    }

    if (this.settings.rssImageMode === "remote") {
      return item.mediaUrls.map((url) => `![](${url})`);
    }

    if (this.settings.rssImageMode !== "download") {
      return [];
    }

    const assetFolder = this.normalizePath(this.settings.rssAssetsFolder);
    if (!assetFolder) {
      return [];
    }

    try {
      await this.ensureFolder(assetFolder);
    } catch (error) {
      await this.appendLog(
        `ERROR: cannot create assets folder ${assetFolder}. ${this.formatError(error)}`
      );
      return [];
    }

    const embeds: string[] = [];
    let index = 0;

    for (const url of item.mediaUrls) {
      index++;
      try {
        const existingPath = this.mediaIndex[url];
        if (this.settings.rssImageDeduplicate && existingPath) {
          const existing = this.app.vault.getAbstractFileByPath(existingPath);
          if (existing instanceof TFile) {
            embeds.push(`![[${existingPath}]]`);
            continue;
          }
          delete this.mediaIndex[url];
          this.markMediaIndexDirty();
        }

        const urlHash = this.hashString(url);
        const baseName = this.buildMediaFileBase(
          context,
          index,
          urlHash
        );
        const extension = this.getUrlExtension(url) || "png";
        const fileName = `${baseName}.${extension}`;
        let filePath = `${assetFolder}/${fileName}`;

        if (this.settings.rssImageDeduplicate) {
          const existing = this.app.vault.getAbstractFileByPath(filePath);
          if (existing instanceof TFile) {
            this.mediaIndex[url] = filePath;
            this.markMediaIndexDirty();
            embeds.push(`![[${filePath}]]`);
            continue;
          }
        }

        const response = await requestUrl({ url, method: "GET" });
        const buffer = response.arrayBuffer;
        const headerExt = this.getExtensionFromContentType(
          response.headers?.["content-type"] ||
            response.headers?.["Content-Type"] ||
            ""
        );

        if (headerExt && headerExt !== extension) {
          filePath = `${assetFolder}/${baseName}.${headerExt}`;
        }

        const existing = this.app.vault.getAbstractFileByPath(filePath);
        if (existing instanceof TFile) {
          await this.app.vault.modifyBinary(existing, buffer);
        } else if (!existing) {
          await this.app.vault.createBinary(filePath, buffer);
        } else {
          await this.appendLog(
            `ERROR: cannot store media, path exists and is not a file: ${filePath}`
          );
          continue;
        }

        if (this.settings.rssImageDeduplicate) {
          this.mediaIndex[url] = filePath;
          this.markMediaIndexDirty();
        }

        embeds.push(`![[${filePath}]]`);
      } catch (error) {
        await this.appendLog(
          `ERROR: failed to download media ${url}. ${this.formatError(error)}`
        );
      }
    }

    return embeds;
  }

  private buildMediaFileBase(
    context: MediaContext,
    index: number,
    hash: string
  ): string {
    const template = this.settings.rssImageNameTemplate.trim();
    const vars = {
      name: context.name,
      type: context.type,
      p_code: context.pCode,
      p_group: context.pGroup,
      section: context.section,
      title: context.title,
      id: context.id,
      index: String(index),
      hash: hash
    };

    let base = this.resolveTemplate(
      template || "{name} - {p_code} - {id} - {index}",
      vars
    );
    base = this.sanitizePathSegment(base);

    if (!base) {
      return hash ? `media-${hash}` : `media-${index}`;
    }

    if (this.settings.rssImageDeduplicate && hash && !template.includes("{hash}")) {
      base = `${base}-${hash}`;
    }

    return base;
  }

  private hashString(value: string): string {
    let hash = 5381;
    for (let i = 0; i < value.length; i++) {
      hash = (hash * 33) ^ value.charCodeAt(i);
    }
    return (hash >>> 0).toString(36);
  }

  private getUrlExtension(url: string): string {
    try {
      const parsed = new URL(url);
      const lastPart = parsed.pathname.split("/").pop() || "";
      const dotIndex = lastPart.lastIndexOf(".");
      if (dotIndex >= 0 && dotIndex < lastPart.length - 1) {
        return lastPart.slice(dotIndex + 1).toLowerCase();
      }
    } catch (error) {
      return "";
    }

    return "";
  }

  private getExtensionFromContentType(contentType: string): string {
    const normalized = contentType.toLowerCase();
    if (normalized.includes("image/png")) {
      return "png";
    }
    if (normalized.includes("image/jpeg")) {
      return "jpg";
    }
    if (normalized.includes("image/webp")) {
      return "webp";
    }
    if (normalized.includes("image/gif")) {
      return "gif";
    }
    return "";
  }

  private sanitizeXml(xml: string): string {
    let sanitized = this.stripInvalidXmlChars(xml);
    sanitized = this.ensureMediaNamespace(sanitized);
    sanitized = this.wrapDescriptionCdata(sanitized);
    sanitized = this.escapeBareAmpersandsOutsideCdata(sanitized);
    return sanitized;
  }

  private stripInvalidXmlChars(xml: string): string {
    return xml.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  }

  private ensureMediaNamespace(xml: string): string {
    if (!/<media:content\b/i.test(xml)) {
      return xml;
    }

    if (/xmlns:media=/i.test(xml)) {
      return xml;
    }

    return xml.replace(/<rss\b[^>]*>/i, (match) => {
      if (match.includes("xmlns:media=")) {
        return match;
      }
      const trimmed = match.slice(0, -1);
      return `${trimmed} xmlns:media="http://search.yahoo.com/mrss/">`;
    });
  }

  private wrapDescriptionCdata(xml: string): string {
    return xml.replace(
      /<description>([\s\S]*?)<\/description>/gi,
      (match, content) => {
        if (content.includes("<![CDATA[")) {
          return match;
        }
        const safeContent = String(content).replace(
          /\]\]>/g,
          "]]]]><![CDATA[>"
        );
        return `<description><![CDATA[${safeContent}]]></description>`;
      }
    );
  }

  private escapeBareAmpersandsOutsideCdata(xml: string): string {
    const cdataRegex = /<!\[CDATA\[[\s\S]*?\]\]>/g;
    let result = "";
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = cdataRegex.exec(xml)) !== null) {
      const segment = xml.slice(lastIndex, match.index);
      result += segment.replace(
        /&(?!#\d+;|#x[0-9a-fA-F]+;|(?:amp|lt|gt|apos|quot);)/g,
        "&amp;"
      );
      result += match[0];
      lastIndex = cdataRegex.lastIndex;
    }

    result += xml
      .slice(lastIndex)
      .replace(
        /&(?!#\d+;|#x[0-9a-fA-F]+;|(?:amp|lt|gt|apos|quot);)/g,
        "&amp;"
      );

    return result;
  }

  private buildSnippet(value: string, limit: number): string {
    const snippet = value.slice(0, limit).replace(/\s+/g, " ").trim();
    if (value.length > limit) {
      return `${snippet}...`;
    }
    return snippet;
  }

  private getParentFolderPath(path: string): string {
    const normalized = this.normalizePath(path);
    if (!normalized) {
      return "";
    }
    const parts = normalized.split("/");
    if (parts.length <= 1) {
      return "";
    }
    return parts.slice(0, -1).join("/");
  }

  private resolveTemplate(template: string, vars: Record<string, string>): string {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      const value = vars[key];
      return value ?? "";
    });
  }

  private normalizePath(path: string): string {
    return path
      .split("/")
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0)
      .join("/");
  }

  private sanitizePathSegment(segment: string): string {
    return segment
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  private async ensureFolder(path: string): Promise<boolean> {
    const normalized = this.normalizePath(path);
    if (!normalized) {
      return false;
    }

    const existing = this.app.vault.getAbstractFileByPath(normalized);
    if (!existing) {
      await this.app.vault.createFolder(normalized);
      return true;
    }

    if (!(existing instanceof TFolder)) {
      throw new Error(`Path exists and is not a folder: ${normalized}`);
    }

    return false;
  }
}

class MkImportRssSettingTab extends PluginSettingTab {
  plugin: MkImportRssPlugin;

  constructor(app: App, plugin: MkImportRssPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "RSS Import" });

    new Setting(containerEl)
      .setName("Log file path")
      .setDesc("Vault path to the log file.")
      .addText((text) =>
        text
          .setPlaceholder("log.md")
          .setValue(this.plugin.settings.logFilePath)
          .onChange(async (value) => {
            this.plugin.settings.logFilePath = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Import RSS now")
      .setDesc("Fetch RSS URL and import items.")
      .addButton((button) => {
        button.setButtonText("Run").onClick(() => {
          this.plugin.runRssPull("manual");
        });
      });

    new Setting(containerEl)
      .setName("Process RSS inbox now")
      .setDesc("Process XML files from the watch folder.")
      .addButton((button) => {
        button.setButtonText("Run").onClick(() => {
          this.plugin.runRssInbox("manual");
        });
      });

    new Setting(containerEl)
      .setName("RSS URL")
      .setDesc("RSS feed URL (pull mode).")
      .addText((text) =>
        text
          .setPlaceholder("https://example.com/rss.xml")
          .setValue(this.plugin.settings.rssUrl)
          .onChange(async (value) => {
            this.plugin.settings.rssUrl = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Last RSS response path")
      .setDesc("Store last RSS response XML for debugging.")
      .addText((text) =>
        text
          .setPlaceholder("rss-last.xml")
          .setValue(this.plugin.settings.rssLastResponsePath)
          .onChange(async (value) => {
            this.plugin.settings.rssLastResponsePath = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Root folder")
      .setDesc("Base folder for imported RSS notes.")
      .addText((text) =>
        text
          .setPlaceholder("000 Metaverse")
          .setValue(this.plugin.settings.rssRootFolder)
          .onChange(async (value) => {
            this.plugin.settings.rssRootFolder = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Path template")
      .setDesc(
        "Template for folders. Tokens: {root}, {type}, {name}, {p_group}, {p_code}, {section}."
      )
      .addText((text) =>
        text
          .setPlaceholder("{root}/{type}/{name}/P{p_group}")
          .setValue(this.plugin.settings.rssPathTemplate)
          .onChange(async (value) => {
            this.plugin.settings.rssPathTemplate = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("File name template")
      .setDesc(
        "Template for file names. Tokens: {title}, {id}, {type}, {name}, {p_group}."
      )
      .addText((text) =>
        text
          .setPlaceholder("{title} ({id})")
          .setValue(this.plugin.settings.rssFileNameTemplate)
          .onChange(async (value) => {
            this.plugin.settings.rssFileNameTemplate = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Missing group folder")
      .setDesc("Fallback folder name when no P[group] code is found.")
      .addText((text) =>
        text
          .setPlaceholder("misc")
          .setValue(this.plugin.settings.rssMissingGroupFolder)
          .onChange(async (value) => {
            this.plugin.settings.rssMissingGroupFolder = value.trim() || "misc";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Update mode")
      .setDesc("When file exists: skip, overwrite, or append.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("skip", "Skip")
          .addOption("overwrite", "Overwrite")
          .addOption("append", "Append")
          .setValue(this.plugin.settings.rssUpdateMode)
          .onChange(async (value: UpdateMode) => {
            this.plugin.settings.rssUpdateMode = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Trim service commands")
      .setDesc("Remove lines like /menu, /mean, or _______.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.rssTrimCommands)
          .onChange(async (value) => {
            this.plugin.settings.rssTrimCommands = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Sanitize XML")
      .setDesc("Escape bare '&' before parsing to avoid XML errors.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.rssSanitizeXml)
          .onChange(async (value) => {
            this.plugin.settings.rssSanitizeXml = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Images")
      .setDesc("How to handle <media:content> URLs.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("off", "Off")
          .addOption("remote", "Embed remote URLs")
          .addOption("download", "Download to vault")
          .setValue(this.plugin.settings.rssImageMode)
          .onChange(async (value: ImageMode) => {
            this.plugin.settings.rssImageMode = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Image filename template")
      .setDesc(
        "Tokens: {name}, {type}, {p_code}, {p_group}, {section}, {title}, {id}, {index}, {hash}."
      )
      .addText((text) =>
        text
          .setPlaceholder("{name} - {p_code} - {id} - {index}")
          .setValue(this.plugin.settings.rssImageNameTemplate)
          .onChange(async (value) => {
            this.plugin.settings.rssImageNameTemplate = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Avoid duplicate downloads")
      .setDesc("Reuse existing image files by URL.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.rssImageDeduplicate)
          .onChange(async (value) => {
            this.plugin.settings.rssImageDeduplicate = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Assets folder")
      .setDesc("Used when Images = Download.")
      .addText((text) =>
        text
          .setPlaceholder("assets/rss")
          .setValue(this.plugin.settings.rssAssetsFolder)
          .onChange(async (value) => {
            this.plugin.settings.rssAssetsFolder = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Run RSS pull on startup")
      .setDesc("Fetch RSS once when Obsidian finishes loading.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.rssPullOnStartup)
          .onChange(async (value) => {
            this.plugin.settings.rssPullOnStartup = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Enable RSS schedule")
      .setDesc("Fetch RSS automatically on an interval.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.rssScheduleEnabled)
          .onChange(async (value) => {
            this.plugin.settings.rssScheduleEnabled = value;
            await this.plugin.saveSettings();
            this.plugin.resetRssSchedule();
          })
      );

    new Setting(containerEl)
      .setName("RSS schedule interval (minutes)")
      .setDesc("Minimum 1 minute.")
      .addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.min = "1";
        text
          .setValue(String(this.plugin.settings.rssScheduleIntervalMinutes))
          .onChange(async (value) => {
            const parsed = Number.parseInt(value, 10);
            this.plugin.settings.rssScheduleIntervalMinutes =
              Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
            await this.plugin.saveSettings();
            this.plugin.resetRssSchedule();
          });
      });

    new Setting(containerEl)
      .setName("Watch folder")
      .setDesc("Enable automatic processing of XML files.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.rssWatchEnabled)
          .onChange(async (value) => {
            this.plugin.settings.rssWatchEnabled = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("RSS inbox folder")
      .setDesc("Folder to watch for XML files (no recursion).")
      .addText((text) =>
        text
          .setPlaceholder("tmpMK/rss-inbox")
          .setValue(this.plugin.settings.rssWatchFolder)
          .onChange(async (value) => {
            this.plugin.settings.rssWatchFolder = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Processed folder")
      .setDesc("Where to move XML files after processing.")
      .addText((text) =>
        text
          .setPlaceholder("tmpMK/rss-processed")
          .setValue(this.plugin.settings.rssProcessedFolder)
          .onChange(async (value) => {
            this.plugin.settings.rssProcessedFolder = value.trim();
            await this.plugin.saveSettings();
          })
      );
  }
}
