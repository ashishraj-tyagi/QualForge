import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { listFeatureFiles } from "../guardrails/rules.js";

/**
 * Offline release-readiness stub. When LLM_API_KEY is set, could summarize
 * Allure/CI logs; MVP emits a structured markdown from local artifacts.
 */
function main(): void {
  const approved = listFeatureFiles(resolve("approved"));
  const drafts = listFeatureFiles(resolve("drafts"));
  const hasOpenApi =
    existsSync(resolve("artifacts/openapi.json")) ||
    existsSync(resolve("artifacts/openapi.snapshot.json"));
  const ciLogHint = existsSync(resolve("artifacts/ci-last.log"))
    ? readFileSync(resolve("artifacts/ci-last.log"), "utf8").slice(0, 2000)
    : null;

  const lines = [
    "# Release readiness summary (QualForge)",
    "",
    `_Generated: ${new Date().toISOString()}_`,
    "",
    "## Portfolio quality gates",
    "",
    `- OpenAPI snapshot present: **${hasOpenApi ? "yes" : "no — run npm run ingest"}**`,
    `- Approved features ready for CI: **${approved.length}**`,
    `- Unreviewed drafts: **${drafts.length}** (must not run in CI)`,
    "",
    "## Approved suite",
    "",
  ];

  if (approved.length === 0) {
    lines.push("- _(none yet — approve drafts after guardrails)_", "");
  } else {
    for (const f of approved) {
      lines.push(`- \`${f.split(/[/\\]/).pop()}\``);
    }
    lines.push("");
  }

  lines.push("## Risk notes", "");
  if (drafts.length > 0) {
    lines.push(
      `- ${drafts.length} draft(s) awaiting human review — do not treat as release evidence.`,
    );
  } else {
    lines.push("- No pending drafts.");
  }
  lines.push(
    "- AI may draft and summarize; merge/execution decisions stay with engineering.",
    "",
  );

  if (ciLogHint) {
    lines.push("## CI log excerpt", "", "```", ciLogHint, "```", "");
  } else {
    lines.push(
      "## CI log",
      "",
      "_No `artifacts/ci-last.log` — download from GitHub Actions and place here for richer summaries._",
      "",
    );
  }

  lines.push(
    "## Recommendation",
    "",
    approved.length > 0 && drafts.length === 0
      ? "**Conditional go** for smoke — run `npm run test:api` / CI `@smoke` before promoting."
      : "**Hold** — finish review loop (ingest → generate → guardrails → approve) before claiming coverage.",
    "",
  );

  mkdirSync(resolve("artifacts"), { recursive: true });
  const out = resolve("artifacts/last-summary.md");
  writeFileSync(out, lines.join("\n"), "utf8");
  console.log(lines.join("\n"));
  console.log(`\nWrote ${out}`);
}

main();
