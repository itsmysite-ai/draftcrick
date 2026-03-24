#!/usr/bin/env bash
# ===========================================
# DraftPlay API — Deploy to Cloud Run
# ===========================================
# Usage:
#   ./scripts/deploy-api.sh 0.1.0
#   ./scripts/deploy-api.sh 0.1.0 --skip-branch

source "$(dirname "$0")/deploy-common.sh"

VERSION="${1:-}"
SKIP_BRANCH=false
[[ "${2:-}" == "--skip-branch" ]] && SKIP_BRANCH=true

if [[ -z "$VERSION" ]]; then
  echo "Usage: ./scripts/deploy-api.sh <version> [--skip-branch]"
  exit 1
fi

SERVICE="draftplay-api"
IMAGE="${REGISTRY}/api"

echo "=== DraftPlay API Deploy v${VERSION} ==="
echo ""

# 1. Release branch
create_release_branch "$VERSION" "$SKIP_BRANCH"

# 2. Build on Cloud Build (no local Docker needed)
echo ""
echo "2. Building and pushing image..."
cloud_build "Dockerfile.api" "$IMAGE" "$VERSION"

# 3. Deploy with server-side env vars
echo ""
echo "3. Deploying to Cloud Run..."
ENV_FILE_PATH="$(get_server_env_file)"

gcloud run deploy "$SERVICE" \
  --image "${IMAGE}:v${VERSION}" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --concurrency 80 \
  --timeout 60s \
  --env-vars-file "$ENV_FILE_PATH"

rm -f "$ENV_FILE_PATH"

# 4. Verify
verify_deployment "$SERVICE" "$VERSION" "/health"

echo ""
echo "Useful commands:"
echo "  Logs:     gcloud run logs read --service=$SERVICE --region=$REGION --limit=50"
echo "  Rollback: gcloud run deploy $SERVICE --region=$REGION --image=${IMAGE}:v<prev-version>"
