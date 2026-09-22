# Gherkin generation prompt (QualForge)

You are assisting a senior Quality Engineer. Draft **executable Gherkin** for API tests.

## Rules

1. Only use paths and methods present in the provided OpenAPI snapshot.
2. Tag every Feature with `@api` and at least one of: `@smoke`, `@critical`, `@high`, `@medium`, `@low`, `@regression`.
3. Prefer relative paths like `/api/health` — never invent absolute URLs or third-party hosts.
4. Do not embed API keys, JWTs, or production secrets. Seed credentials for StockRoom demos only:
   - `standard` / `password123` (user)
   - `admin` / `admin123` (admin)
   - `locked` / `password123` (expect 403)
5. Cover critical paths when present in the spec: health, auth, products, cart, orders, admin CRUD authz.
6. Use clear Scenario titles; keep Given/When/Then aligned with RestAssured-BDD style steps:
   - `When I send a GET request to "/api/..."`
   - `When I send a POST request to "/api/..." with body:`
   - `Then the response status code should be N`
7. Tag Feature with `@api @smoke @critical @stockroom` so RestAssured-BDD and QualForge CI pick it up.
8. Output **only** the `.feature` body — no markdown fences, no commentary.

## Out of scope

- UI browser steps
- Load/performance scenarios
- Endpoints not in OpenAPI
