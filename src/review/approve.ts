import { existsSync, copyFileSync, mkdirSync, unlinkSync } from "node:fs";
import { basename, resolve } from "node:path";
import { checkFeature, loadOpenApiPaths } from "../guardrails/rules.js";
import { readFileSync } from "node:fs";

/**
 * Move a draft feature into approved/ after guardrails pass.
 * Usage: npm run approve -- stockroom_api_smoke.feature
 *    or: npm run approve -- drafts/stockroom_api_smoke.feature
 */
function main(): void {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: npm run approve -- <feature-file>");
    process.exit(1);
  }

  const draftsDir = resolve("drafts");
  const approvedDir = resolve("approved");
  const src = arg.includes("/") || arg.includes("\\")
    ? resolve(arg)
    : resolve(draftsDir, arg);

  if (!existsSync(src)) {
    console.error(`Not found: ${src}`);
    process.exit(1);
  }

  const content = readFileSync(src, "utf8");
  const findings = checkFeature(src, content, loadOpenApiPaths()).filter(
    (f) => f.severity === "error",
  );
  if (findings.length > 0) {
    console.error("Refuse to approve — guardrail errors:");
    for (const f of findings) {
      console.error(`  [${f.rule}] ${f.message}`);
    }
    process.exit(1);
  }

  mkdirSync(approvedDir, { recursive: true });
  const dest = resolve(approvedDir, basename(src));
  copyFileSync(src, dest);
  unlinkSync(src);
  console.log(`Approved → ${dest}`);
  console.log("CI runs approved/ only. Drafts never execute.");
}

main();
