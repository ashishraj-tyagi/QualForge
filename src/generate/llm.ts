import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnv } from "../lib/env.js";
import { generateGherkin, requireLlm } from "./client.js";

loadEnv();

const DRAFTS = resolve("drafts");
const OPENAPI = resolve("artifacts/openapi.json");
const PROMPT = resolve("prompts/generate-gherkin.md");

function stubFeature(paths: string[]): string {
  const samplePath = paths.includes("/api/auth")
    ? "/api/auth"
    : (paths[0] ?? "/api/health");
  return `@api @smoke @critical @stockroom
Feature: StockRoom API smoke (AI stub draft)

  # Generated offline (no LLM_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY).
  # Set a key in .env and re-run \`npm run generate\`, then guardrails + approve.

  Scenario: Health endpoint is reachable
    When I send a GET request to "/api/health"
    Then the response status code should be 200

  Scenario: Login with valid credentials
    When I send a POST request to "${samplePath}" with body:
      """
      {"username":"standard","password":"password123"}
      """
    Then the response status code should be 200
    And the response field "token" should not be empty
`;
}

function extractPaths(openapi: unknown): string[] {
  if (!openapi || typeof openapi !== "object") return [];
  const paths = (openapi as { paths?: Record<string, unknown> }).paths;
  return paths ? Object.keys(paths) : [];
}

function buildUserPrompt(openapiJson: string, systemPrompt: string): string {
  return `${systemPrompt}

---

OpenAPI snapshot (JSON):

\`\`\`json
${openapiJson}
\`\`\`

Generate Gherkin for StockRoom critical paths only: health, auth (success + locked user), products list, cart, checkout/orders, admin product create (authz).
Tag Feature with @api @smoke @critical @stockroom.
Output ONLY valid Gherkin feature file content, no markdown fences.
`;
}

async function main(): Promise<void> {
  const snapshot = resolve("artifacts/openapi.snapshot.json");
  const specPath = existsSync(OPENAPI)
    ? OPENAPI
    : existsSync(snapshot)
      ? snapshot
      : null;
  if (!specPath) {
    console.error(
      "Missing artifacts/openapi.json — run `npm run ingest` (or keep openapi.snapshot.json).",
    );
    process.exit(1);
  }
  if (specPath === snapshot) {
    console.log(
      "Using committed openapi.snapshot.json (run ingest to refresh).",
    );
  }

  const openapi = JSON.parse(readFileSync(specPath, "utf8"));
  const paths = extractPaths(openapi);
  const systemPrompt = existsSync(PROMPT)
    ? readFileSync(PROMPT, "utf8")
    : "Generate tagged Gherkin from OpenAPI.";

  mkdirSync(DRAFTS, { recursive: true });
  const outFile = resolve(DRAFTS, "stockroom_api_smoke.feature");

  try {
    const { content, provider, model } = await generateGherkin(
      systemPrompt,
      buildUserPrompt(JSON.stringify(openapi, null, 2), systemPrompt),
    );
    writeFileSync(
      outFile,
      content.endsWith("\n") ? content : `${content}\n`,
      "utf8",
    );
    console.log(`Wrote LLM draft (${provider}/${model}) → ${outFile}`);
  } catch (err) {
    if (err instanceof Error && err.message === "NO_KEY") {
      if (requireLlm()) {
        console.error(
          "REQUIRE_LLM=true but no API key found. Set LLM_API_KEY (or OPENAI_API_KEY / ANTHROPIC_API_KEY) in .env",
        );
        process.exit(1);
      }
      writeFileSync(outFile, stubFeature(paths), "utf8");
      console.log(
        "No LLM key — wrote offline stub draft. Add LLM_API_KEY to .env for live generation.",
      );
      console.log(`Wrote ${outFile}`);
      return;
    }
    throw err;
  }

  console.log(
    "Next: npm run guardrails  →  review drafts/  →  npm run approve -- <file>",
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
