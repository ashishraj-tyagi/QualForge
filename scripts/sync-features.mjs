#!/usr/bin/env node
/**
 * Sync QualForge approved/*.feature → RestAssured-BDD resources/features/qualforge/
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile() {
  const envPath = resolve(root, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

loadEnvFile();

const approvedDir = resolve(root, "approved");
const restDir = resolve(root, process.env.RESTASSURED_DIR || "../RestAssured-BDD");
const destDir = resolve(restDir, "src/test/resources/features/qualforge");

if (!existsSync(restDir) || !existsSync(resolve(restDir, "pom.xml"))) {
  console.error(`RestAssured-BDD not found at ${restDir}`);
  process.exit(1);
}

if (!existsSync(approvedDir)) {
  console.error(`No approved/ directory at ${approvedDir}`);
  process.exit(1);
}

const features = readdirSync(approvedDir).filter((f) => f.endsWith(".feature"));
if (features.length === 0) {
  console.error("No approved/*.feature files to sync");
  process.exit(1);
}

mkdirSync(destDir, { recursive: true });
for (const name of readdirSync(destDir)) {
  if (name.endsWith(".feature")) {
    rmSync(resolve(destDir, name));
  }
}

for (const name of features) {
  const src = resolve(approvedDir, name);
  let content = readFileSync(src, "utf8");
  if (!/@stockroom\b/.test(content)) {
    content = content.replace(/^(@api\b[^\n]*)/m, "$1 @stockroom");
    if (!/@stockroom\b/.test(content)) {
      content = `@api @stockroom\n${content}`;
    }
  }
  writeFileSync(
    resolve(destDir, name),
    content.endsWith("\n") ? content : `${content}\n`,
  );
  console.log(`Synced ${name} → features/qualforge/`);
}

writeFileSync(
  resolve(destDir, "README.md"),
  "# Generated from QualForge `approved/` — do not edit by hand. Run `npm run sync:features`.\n",
);

console.log(`Done. ${features.length} feature(s) → ${destDir}`);
