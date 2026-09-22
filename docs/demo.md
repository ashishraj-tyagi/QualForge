# 5-minute demo script

Goal: show **ingest → generate → fail guardrail → fix → approve → summarize**.

## 0. Setup (once)

```bash
cd QualForge
cp .env.example .env
npm install
# Optional: start StockRoom on :43124 and run npm run ingest
```

## 1. List review queues

```bash
npm run review:list
```

## 2. Show a blocked AI-style draft

```bash
npm run guardrails -- drafts/examples
```

Expect **ERROR** for invented path and Bearer secret pattern.

## 3. Validate a good draft

```bash
npm run guardrails
```

`drafts/stockroom_products.feature` should pass (uses snapshot OpenAPI).

## 4. Approve after human review

```bash
npm run approve -- stockroom_products.feature
npm run review:list
```

## 5. CI-equivalent check

```bash
npm run guardrails -- approved
npm run summarize
```

Open `artifacts/last-summary.md`.

## Talking points (recruiters / interviews)

- AI never executes unsupervised — only `approved/` is the contract for CI.
- Guardrails encode QE policy (contract, tags, secrets).
- StockRoom is a purpose-built AUT; QualForge is the quality gate around AI-assisted design.
