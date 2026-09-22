import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadRuns } from "./record.js";
import { flakyScore, normalizeError, type RunRecord } from "./types.js";

export type FailureCluster = {
  signature: string;
  count: number;
  tests: string[];
  lastSeen: string;
  examples: string[];
};

export type FlakyTest = {
  fullName: string;
  passes: number;
  fails: number;
  score: number;
  lastStatus: string;
  lastError?: string;
};

export function clusterFailures(runs: RunRecord[]): FailureCluster[] {
  const map = new Map<string, FailureCluster>();
  for (const run of runs) {
    for (const c of run.cases) {
      if (c.status !== "failed") continue;
      const signature = normalizeError(c.errorMessage);
      const existing = map.get(signature) ?? {
        signature,
        count: 0,
        tests: [],
        lastSeen: run.finishedAt,
        examples: [],
      };
      existing.count += 1;
      if (!existing.tests.includes(c.fullName)) existing.tests.push(c.fullName);
      if (existing.examples.length < 3 && c.errorMessage) {
        existing.examples.push(c.errorMessage);
      }
      if (run.finishedAt > existing.lastSeen) existing.lastSeen = run.finishedAt;
      map.set(signature, existing);
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export function detectFlaky(runs: RunRecord[]): FlakyTest[] {
  const byTest = new Map<
    string,
    { passes: number; fails: number; lastStatus: string; lastError?: string }
  >();
  // oldest → newest so lastStatus is latest
  const ordered = [...runs].reverse();
  for (const run of ordered) {
    for (const c of run.cases) {
      const row = byTest.get(c.fullName) ?? {
        passes: 0,
        fails: 0,
        lastStatus: c.status,
      };
      if (c.status === "passed") row.passes += 1;
      if (c.status === "failed") {
        row.fails += 1;
        row.lastError = c.errorMessage;
      }
      row.lastStatus = c.status;
      byTest.set(c.fullName, row);
    }
  }
  return [...byTest.entries()]
    .map(([fullName, row]) => ({
      fullName,
      passes: row.passes,
      fails: row.fails,
      score: flakyScore(row.passes, row.fails),
      lastStatus: row.lastStatus,
      lastError: row.lastError,
    }))
    .filter((t) => t.passes > 0 && t.fails > 0)
    .sort((a, b) => b.score - a.score || b.fails - a.fails);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildDashboardHtml(runs: RunRecord[]): string {
  const clusters = clusterFailures(runs);
  const flaky = detectFlaky(runs);
  const latest = runs[0];
  const passRate = latest
    ? Math.round(
        (100 * latest.cases.filter((c) => c.status === "passed").length) /
          Math.max(latest.cases.length, 1),
      )
    : 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>QualForge Quality Dashboard</title>
  <style>
    :root { --bg:#0f1419; --card:#1a2332; --text:#e7ecf3; --muted:#8b9bb4; --ok:#3dd68c; --bad:#f07178; --warn:#ffcc66; --line:#2a3548; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: "IBM Plex Sans", "Segoe UI", sans-serif; background: radial-gradient(1200px 600px at 10% -10%, #1b2a44, var(--bg)); color: var(--text); }
    main { max-width: 960px; margin: 0 auto; padding: 2.5rem 1.25rem 4rem; }
    h1 { font-size: 1.75rem; margin: 0 0 .25rem; letter-spacing: -0.02em; }
    .sub { color: var(--muted); margin-bottom: 1.75rem; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.75rem; }
    @media (max-width: 700px) { .grid { grid-template-columns: 1fr; } }
    .card { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 1rem 1.1rem; }
    .metric { font-size: 2rem; font-weight: 650; }
    .label { color: var(--muted); font-size: .85rem; text-transform: uppercase; letter-spacing: .06em; }
    h2 { font-size: 1.1rem; margin: 0 0 .75rem; }
    table { width: 100%; border-collapse: collapse; font-size: .92rem; }
    th, td { text-align: left; padding: .55rem .4rem; border-bottom: 1px solid var(--line); vertical-align: top; }
    th { color: var(--muted); font-weight: 560; }
    .ok { color: var(--ok); } .bad { color: var(--bad); } .warn { color: var(--warn); }
    code { font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: .84em; }
    .empty { color: var(--muted); font-style: italic; }
  </style>
</head>
<body>
<main>
  <h1>QualForge Quality Dashboard</h1>
  <p class="sub">Flaky detection + failure clustering from recorded smoke / explore runs.</p>
  <div class="grid">
    <div class="card"><div class="label">Runs tracked</div><div class="metric">${runs.length}</div></div>
    <div class="card"><div class="label">Latest pass rate</div><div class="metric">${passRate}%</div></div>
    <div class="card"><div class="label">Flaky tests</div><div class="metric ${flaky.length ? "warn" : "ok"}">${flaky.length}</div></div>
  </div>

  <section class="card" style="margin-bottom:1.25rem">
    <h2>Latest run</h2>
    ${
      latest
        ? `<p><code>${escapeHtml(latest.source)}</code> · ${escapeHtml(latest.finishedAt)} · ${escapeHtml(latest.baseUrl)}</p>
           <table><thead><tr><th>Case</th><th>Status</th><th>ms</th></tr></thead><tbody>
           ${latest.cases
             .map(
               (c) =>
                 `<tr><td>${escapeHtml(c.name)}</td><td class="${c.status === "passed" ? "ok" : "bad"}">${c.status}</td><td>${c.durationMs}</td></tr>`,
             )
             .join("")}
           </tbody></table>`
        : `<p class="empty">No runs yet — execute <code>npm run test:smoke</code>.</p>`
    }
  </section>

  <section class="card" style="margin-bottom:1.25rem">
    <h2>Flaky tests (pass and fail across history)</h2>
    ${
      flaky.length === 0
        ? `<p class="empty">No flaky patterns in the last ${runs.length} runs.</p>`
        : `<table><thead><tr><th>Test</th><th>Pass</th><th>Fail</th><th>Score</th><th>Last</th></tr></thead><tbody>
        ${flaky
          .map(
            (t) =>
              `<tr><td><code>${escapeHtml(t.fullName)}</code></td><td>${t.passes}</td><td>${t.fails}</td><td class="warn">${t.score}</td><td>${t.lastStatus}</td></tr>`,
          )
          .join("")}
        </tbody></table>`
    }
  </section>

  <section class="card">
    <h2>Failure clusters</h2>
    ${
      clusters.length === 0
        ? `<p class="empty">No failures to cluster.</p>`
        : `<table><thead><tr><th>Signature</th><th>Count</th><th>Tests</th></tr></thead><tbody>
        ${clusters
          .map(
            (c) =>
              `<tr><td><code>${escapeHtml(c.signature)}</code></td><td>${c.count}</td><td>${c.tests.map(escapeHtml).join("<br/>")}</td></tr>`,
          )
          .join("")}
        </tbody></table>`
    }
  </section>
</main>
</body>
</html>`;
}

export function writeDashboard(outPath = resolve("artifacts/dashboard.html")): void {
  mkdirSync(resolve("artifacts"), { recursive: true });
  const runs = loadRuns(100);
  writeFileSync(outPath, buildDashboardHtml(runs));
  const clusters = clusterFailures(runs);
  const flaky = detectFlaky(runs);
  writeFileSync(
    resolve("artifacts/quality-report.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), flaky, clusters, runCount: runs.length }, null, 2) +
      "\n",
  );
  console.log(`Wrote ${outPath}`);
  console.log(`Flaky tests: ${flaky.length}; failure clusters: ${clusters.length}`);
}
