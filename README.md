# QualForge

> AI-assisted test design with **human-in-the-loop guardrails**, executed against
> [StockRoom](../StockRoom) in CI.

[![CI](https://img.shields.io/badge/CI-guardrails-blue)](.github/workflows/ci.yml)
· [StockRoom AUT](../StockRoom)
· [RestAssured-BDD](../RestAssured-BDD)

## Why this exists

Most “AI testing” demos generate flaky scripts and call it done.
QualForge shows how a Quality Engineer uses AI **safely**: draft → validate →
human review → automate → report.

## What it demonstrates

- Shift-left from OpenAPI → Gherkin
- Guardrails (contract, tags, secrets, path allowlist)
- Human approval before execution
- API automation path via RestAssured-BDD + Allure against a purpose-built AUT
- GitHub Actions checks on `approved/` only
- AI used for **drafting and summarizing**, not unsupervised merge

## Architecture

```text
StockRoom OpenAPI → generate (LLM/stub) → drafts/
        → guardrails → human approve → approved/
        → CI / RestAssured-BDD → Allure → summarize
```

See [docs/architecture.md](docs/architecture.md).

## Quick start

### Prerequisites

- Node 20+
- Java 17+ / Maven (when running `npm run test:api` against RestAssured-BDD)
- StockRoom running locally **or** use the committed `artifacts/openapi.snapshot.json`
- Optional: `LLM_API_KEY` for live generation (otherwise offline stub drafts)

### Install

```bash
cd QualForge
cp .env.example .env
npm install
```

### 5-minute loop

```bash
npm run ingest          # fetch OpenAPI (needs StockRoom) — optional if using snapshot
npm run generate        # AI or offline stub → drafts/
npm run guardrails      # fail fast on bad drafts
npm run review:list     # see drafts vs approved
npm run approve -- stockroom_products.feature
npm run guardrails -- approved
npm run summarize       # artifacts/last-summary.md
npm run sync:features   # copy approved/ → RestAssured-BDD
npm run test:api        # RestAssured @smoke @stockroom against StockRoom
npm run test:smoke      # Node smoke (CI-friendly mirror)
```

Walkthrough: [docs/demo.md](docs/demo.md).

## Guardrails (non-negotiable)

| Check | Rule |
|-------|------|
| Tags | Every feature has `@api` and a risk tag (`@smoke`, `@critical`, …) |
| Contract | Paths/methods exist in OpenAPI snapshot |
| Secrets | No tokens/passwords/JWTs hardcoded beyond seed demo creds in prompts |
| Scope | Relative StockRoom API paths only |
| Merge | CI runs **`approved/`** only — never raw `drafts/` |

Policy detail: [docs/guardrails.md](docs/guardrails.md).

## Sample: AI draft blocked by guardrails

```bash
npm run guardrails -- drafts/examples
```

`drafts/examples/bad_openapi_and_secret.feature` invents `/api/totally-fake-admin-backdoor`
and embeds a Bearer token pattern — both fail closed. That failure is the point:
**QE judgment is encoded in the pipeline**, not left to the model.

## CI

- **PR / push:** guardrails on `approved/` + release summary artifact
- **API smoke (optional):** when repo Variable `STOCKROOM_BASE_URL` is set — `npm run test:smoke`
- **Local RestAssured:** `npm run test:api` syncs `approved/` and runs the Java suite

Workflow: [.github/workflows/ci.yml](.github/workflows/ci.yml)

![CI](https://github.com/ashishraj-tyagi/QualForge/actions/workflows/ci.yml/badge.svg)

## LLM generation

```bash
cp .env.example .env
# Add one of:
#   LLM_API_KEY=...          (preferred)
#   OPENAI_API_KEY=...       (LLM_PROVIDER=openai)
#   ANTHROPIC_API_KEY=...    (LLM_PROVIDER=anthropic)
npm run generate             # live draft → drafts/
# REQUIRE_LLM=true npm run generate   # fail if no key (no offline stub)
```

Without a key, `generate` writes a deterministic offline stub so the pipeline stays demoable.

## Portfolio context

| Project | Role |
|---------|------|
| [StockRoom](../StockRoom) | Application under test (auth, cart, orders, admin, OpenAPI) |
| [RestAssured-BDD](../RestAssured-BDD) | Execution + reporting layer |
| **QualForge** | AI-assisted design + quality gates |

## Project layout

```text
QualForge/
├── approved/           # Human-reviewed features (CI)
├── drafts/             # AI output (not executed)
├── artifacts/          # OpenAPI snapshot + summaries
├── prompts/            # LLM system prompt
├── src/
│   ├── ingest/         # OpenAPI fetch
│   ├── generate/       # LLM or stub drafts
│   ├── guardrails/     # Policy checks
│   ├── review/         # list + approve
│   └── summarize/      # Release readiness notes
├── docs/
└── .github/workflows/
```

## 2-week build plan (status)

| Week | Focus | Scaffold status |
|------|--------|-----------------|
| 1 | Ingest, generate, guardrails, review, StockRoom-oriented examples | **Done (scaffold)** |
| 2 | CI, summarize, RestAssured wiring, LLM keys, demo polish | **Done (wired)** |

## What I would add next

- Flaky clustering / quality dashboard
- Bounded exploratory agent with step caps
- Pact / OpenAPI diff on contract change
- Live Allure publish from Actions

## License

MIT
