# Architecture

```text
┌─────────────────┐
│   StockRoom     │  AUT + /api/openapi
└────────┬────────┘
         │ npm run ingest
         ▼
┌─────────────────┐
│ openapi.json    │  (or committed openapi.snapshot.json)
└────────┬────────┘
         │ npm run generate  (LLM or offline stub)
         ▼
┌─────────────────┐
│   drafts/       │  AI output — never executed in CI
└────────┬────────┘
         │ npm run guardrails
         ▼
┌─────────────────┐
│  Guardrails     │  tags · OpenAPI paths · secrets · host allowlist
└────────┬────────┘
         │ human review + npm run approve
         ▼
┌─────────────────┐
│  approved/      │  only this folder is CI-executable
└────────┬────────┘
         │ npm run test:smoke / test:api / explore
         ▼
┌─────────────────────────────────────────────┐
│ history → dashboard (flaky clusters)        │
│ allure-results → GitHub Pages Allure report │
│ contract:diff → openapi-diff + Pact stub    │
└─────────────────────────────────────────────┘
```

## Design principles

1. **AI drafts; humans decide** — nothing in `drafts/` runs in CI.
2. **Contract-first** — OpenAPI is the allowlist for paths.
3. **Fail closed** — guardrail errors block `approve`.
4. **Bounded autonomy** — explore agent has hard step/time caps.
5. **Portfolio triad** — StockRoom (AUT) → QualForge (design gates) → RestAssured-BDD (execution).
