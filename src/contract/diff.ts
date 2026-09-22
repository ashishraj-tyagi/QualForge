import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnv, stockroomBaseUrl, vercelBypassHeaders } from "../lib/env.js";

loadEnv();

type PathMethods = Record<string, unknown>;
type OpenApi = {
  openapi?: string;
  info?: { version?: string; title?: string };
  paths?: Record<string, PathMethods>;
};

export type DiffItem = {
  kind: "added" | "removed" | "changed";
  path: string;
  method?: string;
  detail: string;
  breaking: boolean;
};

function loadJson(path: string): OpenApi {
  return JSON.parse(readFileSync(path, "utf8")) as OpenApi;
}

function methodSet(methods: PathMethods | undefined): Set<string> {
  return new Set(
    Object.keys(methods ?? {}).filter((m) =>
      ["get", "post", "put", "patch", "delete", "head", "options"].includes(
        m.toLowerCase(),
      ),
    ),
  );
}

export function diffOpenApi(baseline: OpenApi, current: OpenApi): DiffItem[] {
  const items: DiffItem[] = [];
  const basePaths = baseline.paths ?? {};
  const currPaths = current.paths ?? {};
  const allPaths = new Set([...Object.keys(basePaths), ...Object.keys(currPaths)]);

  for (const p of [...allPaths].sort()) {
    const b = basePaths[p];
    const c = currPaths[p];
    if (!b && c) {
      items.push({
        kind: "added",
        path: p,
        detail: `Path added (${[...methodSet(c)].join(", ")})`,
        breaking: false,
      });
      continue;
    }
    if (b && !c) {
      items.push({
        kind: "removed",
        path: p,
        detail: "Path removed",
        breaking: true,
      });
      continue;
    }
    const bm = methodSet(b);
    const cm = methodSet(c);
    for (const m of bm) {
      if (!cm.has(m)) {
        items.push({
          kind: "removed",
          path: p,
          method: m.toUpperCase(),
          detail: `Method ${m.toUpperCase()} removed`,
          breaking: true,
        });
      }
    }
    for (const m of cm) {
      if (!bm.has(m)) {
        items.push({
          kind: "added",
          path: p,
          method: m.toUpperCase(),
          detail: `Method ${m.toUpperCase()} added`,
          breaking: false,
        });
      }
    }
  }

  const bv = baseline.info?.version;
  const cv = current.info?.version;
  if (bv && cv && bv !== cv) {
    items.push({
      kind: "changed",
      path: "(info.version)",
      detail: `API version ${bv} → ${cv}`,
      breaking: false,
    });
  }
  return items;
}

function toPactInteractions(current: OpenApi, changed: DiffItem[]) {
  const interactions = [];
  for (const item of changed.filter((i) => i.kind === "added" && i.method)) {
    interactions.push({
      description: `${item.method} ${item.path}`,
      request: {
        method: item.method,
        path: item.path.replace(/\{[^}]+\}/g, "1"),
      },
      response: {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    });
  }
  // Always include health as a stable consumer expectation
  if (current.paths?.["/api/health"]?.get) {
    interactions.unshift({
      description: "health check",
      request: { method: "GET", path: "/api/health" },
      response: { status: 200 },
    });
  }
  return {
    consumer: { name: "QualForge" },
    provider: { name: current.info?.title ?? "StockRoom" },
    interactions,
    metadata: {
      pactSpecification: { version: "2.0.0" },
      generatedBy: "QualForge contract:diff",
    },
  };
}

async function fetchLive(): Promise<OpenApi | null> {
  try {
    const base = stockroomBaseUrl();
    const res = await fetch(`${base}/api/openapi`, {
      headers: vercelBypassHeaders(),
    });
    if (!res.ok) return null;
    return (await res.json()) as OpenApi;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const snapshotPath = resolve("artifacts/openapi.snapshot.json");
  if (!existsSync(snapshotPath)) {
    throw new Error("Missing artifacts/openapi.snapshot.json");
  }
  const baseline = loadJson(snapshotPath);

  let currentPath = resolve("artifacts/openapi.json");
  let current: OpenApi;
  if (existsSync(currentPath)) {
    current = loadJson(currentPath);
  } else {
    console.log("No artifacts/openapi.json — fetching live OpenAPI…");
    const live = await fetchLive();
    if (!live) {
      throw new Error(
        "Could not load current OpenAPI. Run npm run ingest or start StockRoom.",
      );
    }
    mkdirSync(resolve("artifacts"), { recursive: true });
    writeFileSync(currentPath, JSON.stringify(live, null, 2) + "\n");
    current = live;
  }

  const items = diffOpenApi(baseline, current);
  const breaking = items.filter((i) => i.breaking);
  const pact = toPactInteractions(current, items);

  mkdirSync(resolve("artifacts/pacts"), { recursive: true });
  writeFileSync(
    resolve("artifacts/openapi-diff.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        baselineVersion: baseline.info?.version,
        currentVersion: current.info?.version,
        breakingCount: breaking.length,
        items,
      },
      null,
      2,
    ) + "\n",
  );
  writeFileSync(
    resolve("artifacts/pacts/qualforge-stockroom.json"),
    JSON.stringify(pact, null, 2) + "\n",
  );

  const md = [
    "# OpenAPI contract diff",
    "",
    `_Generated: ${new Date().toISOString()}_`,
    "",
    `Breaking changes: **${breaking.length}** / ${items.length} total`,
    "",
  ];
  if (items.length === 0) {
    md.push("_No differences vs snapshot._", "");
  } else {
    md.push("| Kind | Breaking | Path | Detail |", "|------|----------|------|--------|");
    for (const i of items) {
      md.push(
        `| ${i.kind} | ${i.breaking ? "yes" : "no"} | \`${i.method ? i.method + " " : ""}${i.path}\` | ${i.detail} |`,
      );
    }
    md.push("");
  }
  md.push(
    "Pact-style stub written to `artifacts/pacts/qualforge-stockroom.json` (consumer: QualForge).",
    "",
  );
  writeFileSync(resolve("artifacts/openapi-diff.md"), md.join("\n"));

  for (const i of items) {
    const tag = i.breaking ? "BREAKING" : i.kind.toUpperCase();
    console.log(`${tag}  ${i.method ?? ""} ${i.path} — ${i.detail}`);
  }
  console.log(
    `\n${breaking.length} breaking, ${items.length} total. Wrote artifacts/openapi-diff.* and artifacts/pacts/`,
  );

  if (
    process.env.CONTRACT_FAIL_ON_BREAKING === "1" ||
    process.env.CONTRACT_FAIL_ON_BREAKING === "true"
  ) {
    if (breaking.length > 0) process.exit(2);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
