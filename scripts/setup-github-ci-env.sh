#!/usr/bin/env bash
# Push QualForge CI Variable + Secret from a local .env (never commit .env).
# Usage:
#   1. Put values in QualForge/.env (see .env.example)
#   2. ./scripts/setup-github-ci-env.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${1:-$ROOT/.env}"
REPO="${GITHUB_REPOSITORY:-ashishraj-tyagi/QualForge}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy .env.example and add VERCEL_AUTOMATION_BYPASS_SECRET"
  exit 1
fi

# shellcheck disable=SC1090
set -a
# shellcheck source=/dev/null
source <(grep -E '^(STOCKROOM_BASE_URL|VERCEL_AUTOMATION_BYPASS_SECRET)=' "$ENV_FILE" | sed 's/\r$//')
set +a

STOCKROOM_BASE_URL="${STOCKROOM_BASE_URL:-https://stock-room-ashishraj-tyagi.vercel.app}"

echo "Setting Actions variable STOCKROOM_BASE_URL for $REPO ..."
gh variable set STOCKROOM_BASE_URL --repo "$REPO" --body "$STOCKROOM_BASE_URL"
echo "  → $STOCKROOM_BASE_URL"

if [[ -z "${VERCEL_AUTOMATION_BYPASS_SECRET:-}" ]]; then
  echo ""
  echo "VERCEL_AUTOMATION_BYPASS_SECRET is empty in $ENV_FILE"
  echo "Add it from Vercel → Project → Settings → Deployment Protection →"
  echo "  Protection Bypass for Automation, then re-run this script."
  exit 1
fi

echo "Setting Actions secret VERCEL_AUTOMATION_BYPASS_SECRET for $REPO ..."
printf '%s' "$VERCEL_AUTOMATION_BYPASS_SECRET" | gh secret set VERCEL_AUTOMATION_BYPASS_SECRET --repo "$REPO"
echo "  → set (value hidden)"

echo ""
echo "Verify:"
gh variable list --repo "$REPO"
gh secret list --repo "$REPO"
echo ""
echo "Trigger: gh workflow run \"QualForge CI\" --repo $REPO"
