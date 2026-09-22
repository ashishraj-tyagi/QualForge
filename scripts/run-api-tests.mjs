#!/usr/bin/env node
/**
 * Sync approved features into RestAssured-BDD and run @smoke @stockroom tests.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

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

const restDir = resolve(root, process.env.RESTASSURED_DIR || "../RestAssured-BDD");
const baseUrl =
  process.env.STOCKROOM_BASE_URL?.replace(/\/$/, "") ||
  "http://127.0.0.1:43124";

if (!existsSync(restDir) || !existsSync(resolve(restDir, "pom.xml"))) {
  console.error(`RestAssured-BDD not found at ${restDir}`);
  console.error("Set RESTASSURED_DIR in .env to the framework path.");
  process.exit(1);
}

console.log("Syncing QualForge approved/ → RestAssured features/qualforge/");
const sync = spawnSync("node", [resolve(root, "scripts/sync-features.mjs")], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
if (sync.status !== 0) {
  process.exit(sync.status ?? 1);
}

const tags = process.env.CUCUMBER_FILTER_TAGS || "@smoke and @stockroom";
console.log(`Running RestAssured-BDD in ${restDir}`);
console.log(`StockRoom base URL → ${baseUrl}`);
console.log(`Cucumber tags → ${tags}`);

const result = spawnSync(
  "mvn",
  [
    "test",
    `-Dbase.url=${baseUrl}`,
    `-Dcucumber.filter.tags=${tags}`,
  ],
  {
    cwd: restDir,
    stdio: "inherit",
    env: {
      ...process.env,
      BASE_URL: baseUrl,
      STOCKROOM_BASE_URL: baseUrl,
    },
  },
);

process.exit(result.status ?? 1);
