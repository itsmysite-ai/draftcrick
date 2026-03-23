#!/usr/bin/env bash
set -euo pipefail

# ===========================================
# DraftPlay — Deploy all services
# ===========================================
#
# Usage:
#   ./scripts/deploy-all.sh 0.1.0

VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
  echo "Usage: ./scripts/deploy-all.sh <version>"
  echo ""
  echo "Deploys all 3 services with the same version:"
  echo "  1. API      → draftplay-api   (Cloud Run)"
  echo "  2. Web      → draftplay-web   (Cloud Run)"
  echo "  3. App      → draftplay-app   (Cloud Run)"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "======================================"
echo "  DraftPlay Full Deploy v${VERSION}"
echo "======================================"
echo ""

# Only create branch once (first script), others skip
echo ">>> Deploying API..."
"$SCRIPT_DIR/deploy-api.sh" "$VERSION"
echo ""

echo ">>> Deploying Web (Admin)..."
"$SCRIPT_DIR/deploy-web.sh" "$VERSION" --skip-branch
echo ""

echo ">>> Deploying App (User Web)..."
"$SCRIPT_DIR/deploy-app.sh" "$VERSION" --skip-branch
echo ""

echo "======================================"
echo "  All services deployed v${VERSION}"
echo "======================================"
echo ""
echo "Services:"
echo "  API:  https://api.draftplay.ai"
echo "  Web:  https://admin.draftplay.ai"
echo "  App:  https://draftplay.ai"
