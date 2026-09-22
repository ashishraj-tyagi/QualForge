/**
 * Lightweight StockRoom smoke for CI (mirrors approved/stockroom_api_smoke.feature).
 * Records history + Allure results for the quality dashboard / report publish.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { saveRun, writeAllureResults } from "../src/quality/record.js";
import { writeDashboard } from "../src/quality/dashboard.js";
import type { TestCaseResult } from "../src/quality/types.js";

function loadEnvFile(): void {
  const envPath = resolve(".env");
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

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  if (bypass) h["x-vercel-protection-bypass"] = bypass;
  return h;
}

const cases: TestCaseResult[] = [];

async function check(name: string, fn: () => Promise<void>): Promise<void> {
  const fullName = `StockRoom smoke: ${name}`;
  const started = Date.now();
  try {
    await fn();
    cases.push({
      name,
      fullName,
      status: "passed",
      durationMs: Date.now() - started,
    });
    console.log(`PASS  ${name}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    cases.push({
      name,
      fullName,
      status: "failed",
      durationMs: Date.now() - started,
      errorMessage: message,
      errorTrace: err instanceof Error ? err.stack : message,
    });
    console.error(`FAIL  ${name}: ${message}`);
    process.exitCode = 1;
  }
}

function persist(): void {
  saveRun({
    startedAt: new Date(
      Date.now() - cases.reduce((a, c) => a + c.durationMs, 0),
    ).toISOString(),
    source: "smoke",
    baseUrl: base,
    gitSha: process.env.GITHUB_SHA,
    ciRunUrl:
      process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY
        ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
        : undefined,
    cases,
  });
  writeAllureResults(cases, resolve("allure-results"));
  writeDashboard(resolve("artifacts/dashboard.html"));
}

async function main(): Promise<void> {
  console.log(`StockRoom smoke → ${base}`);

  await check("GET /api/health → 200", async () => {
    const res = await fetch(`${base}/api/health`, {
      headers: headers(),
      redirect: "manual",
    });
    if (res.status === 301 || res.status === 302 || res.status === 307) {
      throw new Error(
        `got ${res.status} redirect (Vercel auth?). Set VERCEL_AUTOMATION_BYPASS_SECRET`,
      );
    }
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
    const body = (await res.json()) as { token?: string };
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

  persist();

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
