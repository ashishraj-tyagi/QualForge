# QualForge

> AI-assisted test design with **human-in-the-loop guardrails**, executed against
> [StockRoom](https://github.com/ashishraj-tyagi/StockRoom) in CI.

[![QualForge CI](https://github.com/ashishraj-tyagi/QualForge/actions/workflows/ci.yml/badge.svg)](https://github.com/ashishraj-tyagi/QualForge/actions/workflows/ci.yml)
· [StockRoom AUT](https://github.com/ashishraj-tyagi/StockRoom)
· [RestAssured-BDD](https://github.com/ashishraj-tyagi/RestAssured-BDD)

### Live quality reports

| Report | Link |
|--------|------|
| **Quality dashboard** (flaky clustering, latest runs) | https://ashishraj-tyagi.github.io/QualForge/ |
| **Allure** (latest smoke) | https://ashishraj-tyagi.github.io/QualForge/allure/ |

Also linked from this repo’s GitHub **About → Website** field.

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
- Quality dashboard with **flaky clustering**
- **Bounded exploratory agent** (step + time caps, OpenAPI allowlist)
- **OpenAPI / Pact-style contract diff** on change
- **Live Allure + dashboard** published from Actions to GitHub Pages

## Architecture

```text
StockRoom OpenAPI → generate (LLM/stub) → drafts/
        → guardrails → human approve → approved/
        → CI smoke / RestAssured / explore
        → history → dashboard + Allure (GitHub Pages)
        → contract:diff (snapshot vs live) + Pact stub
```

See [docs/architecture.md](docs/architecture.md).

## Quick start

### Prerequisites

- Node 20+
- Java 17+ (Allure CLI generate in CI; Maven for RestAssured locally)
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
npm run test:smoke      # Node smoke (+ history, dashboard, allure-results)
npm run explore         # bounded exploratory agent
npm run contract:diff   # OpenAPI snapshot vs current + Pact stub
npm run dashboard       # rebuild artifacts/dashboard.html
npm run allure:generate && npm run allure:open
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

## Quality extensions

| Command | Docs |
|---------|------|
| `npm run dashboard` | [docs/quality-dashboard.md](docs/quality-dashboard.md) |
| `npm run explore` | [docs/explore.md](docs/explore.md) |
| `npm run contract:diff` | [docs/contract-diff.md](docs/contract-diff.md) |
| `npm run allure:generate` | [docs/allure.md](docs/allure.md) |

## CI

- **PR / push:** guardrails on `approved/` + contract diff + release summary + smoke
- **Scheduled (3× daily):** StockRoom smoke only — restores prior run history, updates dashboard/Allure on Pages (≈ 09:00 / 13:00 / 18:00 AEST)
- **API smoke:** when `STOCKROOM_BASE_URL` is set — smoke (+ explore on non-schedule), Allure generate
- **Pages:** publishes quality dashboard, Allure, and accumulated `history/` for flaky clustering
- **Local RestAssured:** `npm run test:api`

### Wire Vercel AUT smoke (once)

1. In Vercel: **StockRoom project → Settings → Deployment Protection → Protection Bypass for Automation** — copy the secret.
2. In `QualForge/.env`:

```bash
STOCKROOM_BASE_URL=https://stock-room-ashishraj-tyagi.vercel.app
VERCEL_AUTOMATION_BYPASS_SECRET=paste-secret-here
```

3. Push Variable + Secret to GitHub Actions:

```bash
chmod +x scripts/setup-github-ci-env.sh
./scripts/setup-github-ci-env.sh
```

4. Enable **Settings → Pages → Deploy from branch `gh-pages`** (created by CI).

Workflow: [.github/workflows/ci.yml](.github/workflows/ci.yml)

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
| [StockRoom](https://github.com/ashishraj-tyagi/StockRoom) | Application under test (auth, cart, orders, admin, OpenAPI) |
| [RestAssured-BDD](https://github.com/ashishraj-tyagi/RestAssured-BDD) | Execution + reporting layer (`npm run test:api`) |
| **[QualForge](https://github.com/ashishraj-tyagi/QualForge)** | AI-assisted design + quality gates |

## Project layout

```text
QualForge/
├── approved/           # Human-reviewed features (CI)
├── drafts/             # AI output (not executed)
├── artifacts/          # OpenAPI, diffs, dashboard, explore, history
├── prompts/            # LLM system prompt
├── src/
│   ├── ingest/         # OpenAPI fetch
│   ├── generate/       # LLM or stub drafts
│   ├── guardrails/     # Policy checks
│   ├── review/         # list + approve
│   ├── summarize/      # Release readiness notes
│   ├── quality/        # History, flaky clustering, dashboard
│   ├── explore/        # Bounded exploratory agent
│   └── contract/       # OpenAPI diff + Pact stub
├── scripts/            # Smoke, sync, CI env setup
├── docs/
└── .github/workflows/
```

## License

MIT
