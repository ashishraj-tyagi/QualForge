# OpenAPI / Pact contract diff

Compares `artifacts/openapi.snapshot.json` (baseline) to:

1. `artifacts/openapi.json` if present, else
2. Live `GET /api/openapi` from `STOCKROOM_BASE_URL`

```bash
npm run ingest          # refresh current
npm run contract:diff
# CONTRACT_FAIL_ON_BREAKING=true npm run contract:diff
```

## Outputs

| File | Purpose |
|------|---------|
| `artifacts/openapi-diff.md` | Human-readable breaking / non-breaking changes |
| `artifacts/openapi-diff.json` | Machine-readable |
| `artifacts/pacts/qualforge-stockroom.json` | Pact-style consumer stub for QualForge → StockRoom |

Removed paths/methods are marked **breaking**.
