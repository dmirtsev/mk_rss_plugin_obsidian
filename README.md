# MK Import RSS

English | [Русский](README.ru.md)

Obsidian plugin for importing MK RSS feed items into Markdown notes.

## Features

- Fetches RSS from a URL and turns feed items into notes.
- Can process XML files from an inbox folder inside the vault.
- Organizes imported notes with folder and filename templates.
- Adds `mk_*` metadata to note frontmatter.
- Can embed remote images or download them into the vault.

## Installation

### Best end-user flow

After the plugin is accepted into the official Obsidian Community Plugins directory, users will be able to:

1. Open `Settings -> Community plugins`.
2. Search for `MK Import RSS`.
3. Click `Install`.
4. Enable the plugin.

You can also share this deep link after publication:

```text
obsidian://show-plugin?id=mk-import-rss
```

### Current pre-release install

Until the plugin is published in the official directory, the simplest path is a GitHub Release zip.

#### macOS

1. Download the release zip from GitHub Releases.
2. Extract it.
3. Open the `mk-import-rss` folder.
4. Double-click `install-mk-import-rss.command`.
5. Select your Obsidian vault when Finder prompts you.
6. Enable `MK Import RSS` in `Settings -> Community plugins`.

If macOS blocks the script, right-click it and choose `Open`.

#### Windows

1. Download the release zip from GitHub Releases.
2. Extract it.
3. Open the `mk-import-rss` folder.
4. Right-click `install-mk-import-rss.ps1`.
5. Choose `Run with PowerShell`.
6. Select your Obsidian vault in the folder dialog.
7. Enable `MK Import RSS` in `Settings -> Community plugins`.

If PowerShell blocks execution, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\install-mk-import-rss.ps1
```

#### Manual install

Copy these files into your vault:

```text
.obsidian/plugins/mk-import-rss/
```

Required files:

- `manifest.json`
- `main.js`

Then restart Obsidian or reload community plugins and enable `MK Import RSS`.

## Development

```bash
npm ci
npm run check
npm run build
```

Build output:

- `main.js`
- `manifest.json`

## Packaging

```bash
npm run package
```

This creates:

- `release/mk-import-rss/`
- `release/mk-import-rss-0.1.2.zip`

## Release flow

This repository is configured for automated GitHub Releases.

1. Update `manifest.json` and `versions.json`.
2. Verify locally:

```bash
npm ci
npm run check
npm run package
```

3. Create and push a tag that exactly matches `manifest.json.version`:

```bash
git tag 0.1.2
git push origin 0.1.2
```

GitHub Actions will then:

- run type checking
- build the plugin
- create a GitHub Release
- attach `main.js`, `manifest.json`, optional `styles.css`, and the release zip

## Migration note

This plugin previously used the id `prefix-organizer`. The current id is `mk-import-rss`.

If an older local build is still installed, remove:

```text
.obsidian/plugins/prefix-organizer/
```

Then install:

```text
.obsidian/plugins/mk-import-rss/
```
