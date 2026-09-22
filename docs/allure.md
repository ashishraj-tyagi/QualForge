# Allure reports from Actions

Smoke writes Allure 2 result JSON into `allure-results/`.

```bash
npm run test:smoke
npm run allure:generate
npm run allure:open
```

## CI publish

On `main`, after smoke (success or fail), the workflow:

1. Generates `allure-report/`
2. Copies dashboard + Allure into `public-site/`
3. Deploys with `peaceiris/actions-gh-pages` → `gh-pages` branch

Enable Pages: repo **Settings → Pages → Deploy from branch `gh-pages` / root**.

Live URLs (after first successful publish):

- Dashboard: https://ashishraj-tyagi.github.io/QualForge/
- Allure: https://ashishraj-tyagi.github.io/QualForge/allure/
