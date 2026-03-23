#!/usr/bin/env bash
# ===========================================
# DraftPlay User App (Web) — Deploy Expo web to Cloud Run
# ===========================================
# Usage:
#   ./scripts/deploy-app.sh 0.1.0
#   ./scripts/deploy-app.sh 0.1.0 --skip-branch

source "$(dirname "$0")/deploy-common.sh"

VERSION="${1:-}"
SKIP_BRANCH=false
[[ "${2:-}" == "--skip-branch" ]] && SKIP_BRANCH=true

if [[ -z "$VERSION" ]]; then
  echo "Usage: ./scripts/deploy-app.sh <version> [--skip-branch]"
  exit 1
fi

SERVICE="draftplay-app"
IMAGE="${REGISTRY}/app"

echo "=== DraftPlay App (Web) Deploy v${VERSION} ==="
echo ""

# 1. Release branch
create_release_branch "$VERSION" "$SKIP_BRANCH"

# 2. Build on Cloud Build with EXPO_PUBLIC_ args
echo ""
echo "2. Building and pushing image..."
SUBS="$(get_expo_substitutions)"
[[ -n "$SUBS" ]] && SUBS="${SUBS},"
SUBS="${SUBS}_EXPO_PUBLIC_API_URL=https://api.draftplay.ai/trpc"
cloud_build "Dockerfile.app" "$IMAGE" "$VERSION" "$SUBS"

# 3. Deploy
echo ""
echo "3. Deploying to Cloud Run..."
gcloud run deploy "$SERVICE" \
  --image "${IMAGE}:v${VERSION}" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 128Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 5 \
  --concurrency 200 \
  --timeout 30s

# 4. Verify
verify_deployment "$SERVICE" "$VERSION" "/"
