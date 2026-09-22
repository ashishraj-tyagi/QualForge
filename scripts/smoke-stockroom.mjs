#!/usr/bin/env node
/**
 * Lightweight StockRoom smoke for CI (mirrors approved/stockroom_api_smoke.feature).
 * Local full suite: npm run test:api (RestAssured-BDD).
 */
import { existsSync, readFileSync } from "node:fs";
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

const base =
  process.env.STOCKROOM_BASE_URL?.replace(/\/$/, "") ||
  "http://127.0.0.1:43124";

function headers() {
  const h = { "Content-Type": "application/json", Accept: "application/json" };
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  if (bypass) h["x-vercel-protection-bypass"] = bypass;
  return h;
}

async function check(name, fn) {
  try {
    await fn();
    console.log(`PASS  ${name}`);
  } catch (err) {
    console.error(`FAIL  ${name}: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  }
}

async function main() {
  console.log(`StockRoom smoke → ${base}`);

  await check("GET /api/health → 200", async () => {
    const res = await fetch(`${base}/api/health`, { headers: headers() });
    if (!res.ok) throw new Error(`status ${res.status}`);
  });

  await check("POST /api/auth standard → 200 + token", async () => {
    const res = await fetch(`${base}/api/auth`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        username: "standard",
        password: "password123",
      }),
    });
    if (res.status !== 200) throw new Error(`status ${res.status}`);
    const body = await res.json();
    if (!body.token) throw new Error("missing token");
  });

  await check("POST /api/auth locked → 403", async () => {
    const res = await fetch(`${base}/api/auth`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        username: "locked",
        password: "password123",
      }),
    });
    if (res.status !== 403) throw new Error(`expected 403, got ${res.status}`);
  });

  if (process.exitCode) {
    console.error("Smoke failed.");
    process.exit(1);
  }
  console.log("Smoke passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
