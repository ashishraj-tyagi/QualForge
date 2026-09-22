# Quality dashboard & flaky clustering

```bash
npm run test:smoke    # records artifacts/history + allure-results
npm run dashboard     # regenerates artifacts/dashboard.html
```

Open `artifacts/dashboard.html` locally, or the GitHub Pages site after CI publish:
https://ashishraj-tyagi.github.io/QualForge/

## What it shows

- Latest run pass rate
- **Flaky tests** — cases that both passed and failed across history
- **Failure clusters** — normalized error signatures (IDs/URLs stripped)

## Scheduled smoke (3× daily)

GitHub Actions runs StockRoom smoke **three times per day** (UTC crons ≈ **09:00 / 13:00 / 18:00 AEST**).

Each run:

1. Restores prior `history/` from the `gh-pages` site
2. Appends a new smoke result
3. Prunes to the newest ~90 runs (`HISTORY_KEEP`, ~30 days at 3/day)
4. Rebuilds the dashboard and republishes Pages (including `history/`)

That accumulation is what makes flaky clustering meaningful over time.

Trigger manually: Actions → QualForge CI → **Run workflow**.

> GitHub may pause scheduled workflows after ~60 days of repo inactivity — push or re-enable if schedules stop.
