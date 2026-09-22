# Bounded exploratory agent

```bash
npm run explore
# EXPLORE_MAX_STEPS=8 EXPLORE_TIMEOUT_MS=15000 npm run explore
```

## Bounds (non-negotiable)

| Cap | Default | Env |
|-----|---------|-----|
| Max steps | 12 | `EXPLORE_MAX_STEPS` |
| Wall timeout | 20s | `EXPLORE_TIMEOUT_MS` |
| Path allowlist | OpenAPI snapshot / live | — |
| Mutations | Skipped except `POST /api/auth` | — |

Outputs: `artifacts/explore-report.md` + `.json` with step log and findings.
