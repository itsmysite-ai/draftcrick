#!/usr/bin/env bash
# ===========================================
# DraftPlay User App (Web) — Deploy to Cloudflare Pages
# ===========================================
# Usage:
#   ./scripts/deploy-app.sh 0.1.0
#   ./scripts/deploy-app.sh 0.1.0 --skip-branch

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env.production"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: .env.production not found"
  exit 1
fi

# Load env vars from .env.production
while IFS= read -r line; do
  [[ -z "$line" || "$line" =~ ^# ]] && continue
  key=$(echo "$line" | cut -d'=' -f1)
  val=$(echo "$line" | cut -d'=' -f2-)
  [[ -z "$val" ]] && continue
  export "$key=$val"
done < "$ENV_FILE"

VERSION="${1:-}"
SKIP_BRANCH=false
[[ "${2:-}" == "--skip-branch" ]] && SKIP_BRANCH=true

if [[ -z "$VERSION" ]]; then
  echo "Usage: ./scripts/deploy-app.sh <version> [--skip-branch]"
  exit 1
fi

if [[ -z "${CF_API_TOKEN:-}" || -z "${CF_ACCOUNT_ID:-}" ]]; then
  echo "ERROR: CF_API_TOKEN and CF_ACCOUNT_ID must be set in .env.production"
  exit 1
fi

echo "=== DraftPlay App (Web) Deploy v${VERSION} ==="
echo ""

# 1. Release branch (optional)
if [[ "$SKIP_BRANCH" != true ]]; then
  echo "1. Creating release branch..."
  branch="release/v${VERSION}"
  git checkout -b "$branch" 2>/dev/null || git checkout "$branch"
  git tag -a "v${VERSION}" -m "Release v${VERSION}" 2>/dev/null || true
  git push origin "$branch" --tags
  echo "   Branch: $branch"
else
  echo "1. Skipping branch creation"
fi

# 2. Build Expo web export
echo ""
echo "2. Building Expo web export..."

# Set prod env vars
export EXPO_PUBLIC_API_URL="https://draftplay-api-445576271033.asia-south1.run.app/trpc"

# CRITICAL: Hide .env.local during prod build so emulator vars don't leak
[[ -f "${ROOT_DIR}/apps/mobile/.env.local" ]] && mv "${ROOT_DIR}/apps/mobile/.env.local" "${ROOT_DIR}/apps/mobile/.env.local.bak"
[[ -f "${ROOT_DIR}/.env.local" ]] && mv "${ROOT_DIR}/.env.local" "${ROOT_DIR}/.env.local.bak"

unset EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST
unset FIREBASE_AUTH_EMULATOR_HOST

cd "${ROOT_DIR}/apps/mobile"
npx expo export --platform web --clear
cd "$ROOT_DIR"

# Restore .env.local files
[[ -f "${ROOT_DIR}/apps/mobile/.env.local.bak" ]] && mv "${ROOT_DIR}/apps/mobile/.env.local.bak" "${ROOT_DIR}/apps/mobile/.env.local"
[[ -f "${ROOT_DIR}/.env.local.bak" ]] && mv "${ROOT_DIR}/.env.local.bak" "${ROOT_DIR}/.env.local"
echo "   Built: apps/mobile/dist/"

# 3. Deploy to Cloudflare Pages
echo ""
echo "3. Deploying to Cloudflare Pages..."

CLOUDFLARE_API_TOKEN="$CF_API_TOKEN" \
CLOUDFLARE_ACCOUNT_ID="$CF_ACCOUNT_ID" \
npx wrangler@latest pages deploy "${ROOT_DIR}/apps/mobile/dist" \
  --project-name=draftplay-app \
  --branch=main \
  --commit-message="v${VERSION}" \
  --commit-dirty=true

# 4. Verify
echo ""
echo "4. Verifying..."
sleep 5
if curl -sf "https://app.draftplay.ai" -o /dev/null -w "   HTTP %{http_code}\n"; then
  echo ""
  echo "=== draftplay-app v${VERSION} DEPLOYED ==="
  echo "   https://app.draftplay.ai"
else
  echo ""
  echo "=== WARNING: app.draftplay.ai not responding (DNS may still be propagating) ==="
  echo "   Try: https://draftplay-app.pages.dev"
fi
