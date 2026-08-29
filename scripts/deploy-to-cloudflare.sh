#!/usr/bin/env bash
# Deploy Classroom SimCity to Cloudflare (Worker API + Pages frontend)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "ERROR: Set CLOUDFLARE_API_TOKEN (Cloudflare dashboard → API Tokens)"
  echo "Also set CLOUDFLARE_ACCOUNT_ID if wrangler cannot infer it."
  exit 1
fi

export CLOUDFLARE_API_TOKEN

echo "==> Deploying Worker API..."
npx wrangler deploy

WORKER_URL="https://classroom-simcity-api.$(npx wrangler whoami 2>/dev/null | grep -oP 'subdomain: \K.*' || echo 'YOUR_SUBDOMAIN').workers.dev"
# Fallback: read from deploy output
if [[ -f .wrangler-deploy-url ]]; then
  WORKER_URL=$(cat .wrangler-deploy-url)
fi

echo "==> Building frontend (API: ${VITE_API_URL:-$WORKER_URL})..."
export VITE_API_URL="${VITE_API_URL:-$WORKER_URL}"
npm run build

echo "==> Deploying Pages..."
npx wrangler pages deploy dist --project-name=classroom-simcity --commit-dirty=true

echo ""
echo "Done!"
echo "  Worker API: $VITE_API_URL"
echo "  Pages:      https://classroom-simcity.pages.dev (or custom domain)"
echo ""
echo "Post-deploy:"
echo "  1. Update ALLOWED_ORIGIN in wrangler.toml to your Pages URL if different"
echo "  2. wrangler secret put SESSION_SECRET  (if not using wrangler.toml vars)"
echo "  3. Admin login: admin / classroom123 (change immediately)"
