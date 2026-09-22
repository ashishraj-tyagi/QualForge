import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { RunRecord, TestCaseResult } from "./types.js";

const HISTORY_DIR = resolve("artifacts/history");

export function historyDir(): string {
  mkdirSync(HISTORY_DIR, { recursive: true });
  return HISTORY_DIR;
}

export function saveRun(
  partial: Omit<RunRecord, "id" | "finishedAt"> & { id?: string },
): RunRecord {
  const record: RunRecord = {
    ...partial,
    id: partial.id ?? randomUUID(),
    finishedAt: new Date().toISOString(),
  };
  const dir = historyDir();
  const stamp = record.finishedAt.replace(/[:.]/g, "-");
  const file = resolve(dir, `${stamp}_${record.id.slice(0, 8)}.json`);
  writeFileSync(file, JSON.stringify(record, null, 2) + "\n");
  writeFileSync(
    resolve("artifacts/last-run.json"),
    JSON.stringify(record, null, 2) + "\n",
  );
  return record;
}

export function loadRuns(limit = 50): RunRecord[] {
  const dir = historyDir();
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse()
    .slice(0, limit);
  return files.map(
    (f) => JSON.parse(readFileSync(resolve(dir, f), "utf8")) as RunRecord,
  );
}

export function writeAllureResults(
  cases: TestCaseResult[],
  outDir = resolve("allure-results"),
): void {
  mkdirSync(outDir, { recursive: true });
  for (const f of readdirSync(outDir)) {
    if (
      f.endsWith("-result.json") ||
      f.endsWith("-container.json") ||
      f === "executor.json" ||
      f === "environment.properties"
    ) {
      unlinkSync(resolve(outDir, f));
    }
  }

  const containerUuid = randomUUID();
  const children: string[] = [];
  const now = Date.now();
  const totalDuration = cases.reduce((a, c) => a + c.durationMs, 0);

  for (const c of cases) {
    const uuid = randomUUID();
    children.push(uuid);
    const stop = now;
    const start = stop - Math.max(c.durationMs, 1);
    const status =
      c.status === "passed"
        ? "passed"
        : c.status === "skipped"
          ? "skipped"
          : "failed";
    const result = {
      uuid,
      historyId: c.fullName,
      name: c.name,
      fullName: c.fullName,
      status,
      stage: "finished",
      start,
      stop,
      labels: [
        { name: "suite", value: "StockRoom smoke" },
        { name: "framework", value: "qualforge" },
        { name: "language", value: "javascript" },
      ],
      statusDetails: c.errorMessage
        ? {
            message: c.errorMessage,
            trace: c.errorTrace ?? c.errorMessage,
          }
        : undefined,
    };
    writeFileSync(resolve(outDir, `${uuid}-result.json`), JSON.stringify(result));
  }

  writeFileSync(
    resolve(outDir, `${containerUuid}-container.json`),
    JSON.stringify({
      uuid: containerUuid,
      name: "QualForge StockRoom smoke",
      children,
      start: now - totalDuration,
      stop: now,
    }),
  );

  const buildUrl =
    process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : undefined;

  writeFileSync(
    resolve(outDir, "executor.json"),
    JSON.stringify({
      name: "QualForge",
      type: "github",
      buildName: process.env.GITHUB_RUN_NUMBER
        ? `CI #${process.env.GITHUB_RUN_NUMBER}`
        : "local",
      buildUrl,
      reportUrl: process.env.ALLURE_REPORT_URL,
    }),
  );

  writeFileSync(
    resolve(outDir, "environment.properties"),
    [
      `STOCKROOM_BASE_URL=${process.env.STOCKROOM_BASE_URL ?? ""}`,
      `GIT_SHA=${process.env.GITHUB_SHA ?? ""}`,
      `RUN_AT=${new Date().toISOString()}`,
    ].join("\n") + "\n",
  );
}
