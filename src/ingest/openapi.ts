import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadEnv, stockroomBaseUrl, vercelBypassHeaders } from "../lib/env.js";

loadEnv();

const outPath = resolve("artifacts/openapi.json");

async function main(): Promise<void> {
  const base = stockroomBaseUrl();
  const url = `${base}/api/openapi`;
  console.log(`Ingesting OpenAPI from ${url}`);

  const res = await fetch(url, { headers: vercelBypassHeaders() });
  if (!res.ok) {
    throw new Error(
      `OpenAPI fetch failed: ${res.status} ${res.statusText}. Is StockRoom running at ${base}?`,
    );
  }

  const body = (await res.json()) as { openapi?: string; paths?: unknown };
  if (!body.openapi || !body.paths) {
    throw new Error("Response does not look like an OpenAPI document");
  }

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(body, null, 2) + "\n", "utf8");
  const pathCount = Object.keys(body.paths as object).length;
  console.log(`Wrote ${outPath} (${pathCount} paths)`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
