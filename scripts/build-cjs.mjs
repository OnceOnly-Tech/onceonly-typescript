import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const cjsDir = path.join(root, "dist-cjs");
const distDir = path.join(root, "dist");

if (!fs.existsSync(cjsDir)) {
  process.exit(0);
}

for (const file of fs.readdirSync(cjsDir)) {
  if (!file.endsWith(".js")) {
    continue;
  }
  const source = path.join(cjsDir, file);
  const target = path.join(distDir, file.replace(/\.js$/, ".cjs"));
  const raw = fs.readFileSync(source, "utf-8");
  const patched = raw
    .replace(/require\("(\.\/[^"]+)\.js"\)/g, 'require("$1.cjs")')
    .replace(/require\("(\.\/[^".]+)"\)/g, 'require("$1.cjs")');
  fs.writeFileSync(target, patched, "utf-8");
}

fs.rmSync(cjsDir, { recursive: true, force: true });
