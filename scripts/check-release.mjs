import fs from "node:fs";
import path from "node:path";

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function extractVersionFromTs(file) {
  const text = fs.readFileSync(file, "utf-8");
  const m = text.match(/VERSION\s*=\s*"([^"]+)"/);
  if (!m) {
    throw new Error(`Unable to find VERSION in ${file}`);
  }
  return m[1].trim();
}

const root = process.cwd();
const packageJson = readJson(path.join(root, "package.json"));
const versionTs = extractVersionFromTs(path.join(root, "src/version.ts"));
const changelogPath = path.join(root, "CHANGELOG.md");

if (packageJson.version !== versionTs) {
  console.error(`Version mismatch: package.json=${packageJson.version} src/version.ts=${versionTs}`);
  process.exit(1);
}

if (!fs.existsSync(changelogPath)) {
  console.error("Missing CHANGELOG.md");
  process.exit(1);
}

const changelog = fs.readFileSync(changelogPath, "utf-8");
const hasVersion = new RegExp(`^##\\s*\\[${versionTs.replace(/\./g, "\\.")}\\]`, "m").test(changelog);
if (!hasVersion) {
  console.error(`CHANGELOG.md missing version entry ${versionTs}`);
  process.exit(1);
}

console.log("OK");
