import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { checkFeature, listFeatureFiles, loadOpenApiPaths } from "./rules.js";

const target = process.argv[2] || "drafts";
const dir = resolve(target);

function main(): void {
  const files = listFeatureFiles(dir);
  if (files.length === 0) {
    console.error(`No .feature files in ${dir}`);
    process.exit(1);
  }

  const openApiPaths = loadOpenApiPaths();
  let errors = 0;
  let warns = 0;

  console.log(`Guardrails on ${dir} (${files.length} file(s))\n`);

  for (const file of files) {
    const content = readFileSync(file, "utf8");
    const findings = checkFeature(file, content, openApiPaths);
    for (const f of findings) {
      const label = f.severity === "error" ? "ERROR" : "WARN ";
      console.log(`${label}  [${f.rule}] ${f.file}: ${f.message}`);
      if (f.severity === "error") errors += 1;
      else warns += 1;
    }
    if (findings.length === 0) {
      console.log(`OK     ${file.split(/[/\\]/).pop()}`);
    }
  }

  console.log(`\n${errors} error(s), ${warns} warning(s)`);
  if (errors > 0) {
    console.error("Guardrails failed — fix drafts before approve/CI.");
    process.exit(1);
  }
  console.log("Guardrails passed.");
}

main();
