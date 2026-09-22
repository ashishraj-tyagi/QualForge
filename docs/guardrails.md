# Guardrails

QualForge treats AI output as **untrusted** until it passes automated checks and human approval.

## Non-negotiable checks

| Rule | Severity | What it enforces |
|------|----------|------------------|
| `required-tag` | error | Feature has `@api` |
| `risk-tag` | error | Feature has `@smoke` / `@critical` / `@high` / `@medium` / `@low` / `@regression` |
| `openapi-path` | error | Every `send a METHOD request to "/path"` exists in OpenAPI snapshot |
| `secret-token` / `secret-bearer` / … | error | No leaked keys, JWTs, or inline long secrets |
| `host-allowlist` | error | No absolute URLs outside StockRoom hosts |
| `has-scenario` | error | At least one Scenario |
| `no-http-steps` | warn | Could not parse HTTP steps (step style may differ) |
| `missing-openapi` | warn | No snapshot — contract checks skipped |

## What AI may do

- Draft Gherkin from OpenAPI / prompts
- Propose scenarios for critical paths
- Summarize CI / Allure into release-readiness notes

## What AI must not do

- Merge or mark tests as approved
- Invent endpoints not in OpenAPI
- Hard-code production secrets
- Browse arbitrary hosts
- Skip human review

## Commands

```bash
npm run guardrails              # drafts/
npm run guardrails -- approved  # CI target
npm run guardrails -- drafts/examples
```

## Demo failure

`drafts/examples/bad_openapi_and_secret.feature` fails path + secret rules on purpose.
