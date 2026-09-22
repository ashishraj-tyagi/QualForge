export type TestOutcome = "passed" | "failed" | "skipped";

export type TestCaseResult = {
  name: string;
  fullName: string;
  status: TestOutcome;
  durationMs: number;
  errorMessage?: string;
  errorTrace?: string;
};

export type RunRecord = {
  id: string;
  startedAt: string;
  finishedAt: string;
  source: "smoke" | "explore" | "api" | "manual";
  baseUrl: string;
  gitSha?: string;
  ciRunUrl?: string;
  cases: TestCaseResult[];
};

export function normalizeError(message: string | undefined): string {
  if (!message) return "(no message)";
  return message
    .replace(/\b\d{2,}\b/g, "N")
    .replace(/[0-9a-f]{8,}/gi, "HEX")
    .replace(/https?:\/\/[^\s]+/g, "URL")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

export function flakyScore(passes: number, fails: number): number {
  const total = passes + fails;
  if (total < 2) return 0;
  // Peak flakiness when ~50/50
  const ratio = Math.min(passes, fails) / total;
  return Math.round(ratio * 200) / 100; // 0..1
}
