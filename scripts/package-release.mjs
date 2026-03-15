import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync
} from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const manifestPath = path.join(rootDir, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const pluginId = manifest.id;
const version = manifest.version;

if (!pluginId || !version) {
  throw new Error("manifest.json must contain id and version.");
}

const releaseDir = path.join(rootDir, "release");
const stageDir = path.join(releaseDir, pluginId);
const zipPath = path.join(releaseDir, `${pluginId}-${version}.zip`);

const releaseFiles = [
  "main.js",
  "manifest.json",
  "README.md",
  "LICENSE",
  "versions.json",
  "install-mk-import-rss.command",
  "install-mk-import-rss.ps1"
];

execFileSync("npm", ["run", "build"], {
  cwd: rootDir,
  stdio: "inherit"
});

rmSync(stageDir, { recursive: true, force: true });
rmSync(zipPath, { force: true });
mkdirSync(stageDir, { recursive: true });

for (const file of releaseFiles) {
  const source = path.join(rootDir, file);
  if (!existsSync(source)) {
    throw new Error(`Missing release file: ${file}`);
  }

  const destination = path.join(stageDir, path.basename(file));
  copyFileSync(source, destination);
}

const stylesPath = path.join(rootDir, "styles.css");
if (existsSync(stylesPath)) {
  copyFileSync(stylesPath, path.join(stageDir, "styles.css"));
}

execFileSync("zip", ["-r", "-q", path.basename(zipPath), pluginId], {
  cwd: releaseDir,
  stdio: "inherit"
});

console.log(`Release folder: ${stageDir}`);
console.log(`Release zip: ${zipPath}`);
