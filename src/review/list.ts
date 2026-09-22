import { resolve } from "node:path";
import { listFeatureFiles } from "../guardrails/rules.js";

function list(label: string, dir: string): void {
  const files = listFeatureFiles(resolve(dir));
  console.log(`\n${label} (${files.length}):`);
  if (files.length === 0) {
    console.log("  (empty)");
    return;
  }
  for (const f of files) {
    console.log(`  - ${f.split(/[/\\]/).pop()}`);
  }
}

list("drafts/  (AI output — not executed)", "drafts");
list("approved/ (human-reviewed — CI target)", "approved");
console.log("");
