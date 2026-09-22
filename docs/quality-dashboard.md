# Quality dashboard & flaky clustering

```bash
npm run test:smoke    # records artifacts/history + allure-results
npm run dashboard     # regenerates artifacts/dashboard.html
```

Open `artifacts/dashboard.html` locally, or the GitHub Pages site after CI publish.

## What it shows

- Latest run pass rate
- **Flaky tests** — cases that both passed and failed across history
- **Failure clusters** — normalized error signatures (IDs/URLs stripped)
