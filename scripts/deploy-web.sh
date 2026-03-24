#!/usr/bin/env bash
# ===========================================
# DraftPlay Admin — Deploy Next.js to Cloud Run
# ===========================================
# Proxied via Cloudflare Worker (draftplay-admin-proxy) at draftplay.ai
#
# Usage:
#   ./scripts/deploy-web.sh 0.1.0
#   ./scripts/deploy-web.sh 0.1.0 --skip-branch

source "$(dirname "$0")/deploy-common.sh"

VERSION="${1:-}"
SKIP_BRANCH=false
[[ "${2:-}" == "--skip-branch" ]] && SKIP_BRANCH=true

if [[ -z "$VERSION" ]]; then
  echo "Usage: ./scripts/deploy-web.sh <version> [--skip-branch]"
  exit 1
fi

SERVICE="draftplay-web"
IMAGE="${REGISTRY}/web"

echo "=== DraftPlay Web (Admin) Deploy v${VERSION} ==="
echo ""

# 1. Release branch
create_release_branch "$VERSION" "$SKIP_BRANCH"

# 2. Build on Cloud Build with NEXT_PUBLIC_ args
echo ""
echo "2. Building and pushing image..."
SUBS="$(get_next_substitutions)"
[[ -n "$SUBS" ]] && SUBS="${SUBS},"
SUBS="${SUBS}_NEXT_PUBLIC_API_URL=https://draftplay-api-445576271033.asia-south1.run.app/trpc"
cloud_build "Dockerfile.web" "$IMAGE" "$VERSION" "$SUBS"

# 3. Deploy
echo ""
echo "3. Deploying to Cloud Run..."
gcloud run deploy "$SERVICE" \
  --image "${IMAGE}:v${VERSION}" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 256Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 5 \
  --concurrency 80 \
  --timeout 30s

# 4. Verify (via custom domain)
echo ""
echo "4. Verifying..."
sleep 5
if curl -sf "https://draftplay.ai" -o /dev/null -w "   HTTP %{http_code}\n"; then
  echo ""
  echo "=== draftplay-web v${VERSION} DEPLOYED ==="
  echo "   https://draftplay.ai (via Cloudflare Worker proxy)"
else
  # Fallback: check Cloud Run URL directly
  verify_deployment "$SERVICE" "$VERSION" "/"
fi
