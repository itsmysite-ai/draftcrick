#!/usr/bin/env bash
# ===========================================
# DraftPlay — Cloudflare Infrastructure Setup
# ===========================================
# Recreates all Cloudflare Workers, Pages projects, DNS records, and custom domains.
# Run this if you need to rebuild Cloudflare infra from scratch.
#
# Prerequisites:
#   - .env.production with CF_API_TOKEN and CF_ACCOUNT_ID set
#   - wrangler: npx wrangler@latest (auto-installed via npx)
#
# Architecture:
#   - API (Hono/tRPC)  → Cloud Run directly (no Cloudflare proxy)
#   - Admin (Next.js)  → Cloud Run, proxied via CF Worker at draftplay.ai
#   - App (Expo web)   → Cloudflare Pages at app.draftplay.ai
#
# Usage:
#   ./scripts/setup-cloudflare.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env.production"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: .env.production not found"
  exit 1
fi

# Load env vars
while IFS= read -r line; do
  [[ -z "$line" || "$line" =~ ^# ]] && continue
  key=$(echo "$line" | cut -d'=' -f1)
  val=$(echo "$line" | cut -d'=' -f2-)
  [[ -z "$val" ]] && continue
  export "$key=$val"
done < "$ENV_FILE"

if [[ -z "${CF_API_TOKEN:-}" || -z "${CF_ACCOUNT_ID:-}" ]]; then
  echo "ERROR: CF_API_TOKEN and CF_ACCOUNT_ID must be set in .env.production"
  exit 1
fi

export CLOUDFLARE_API_TOKEN="$CF_API_TOKEN"
export CLOUDFLARE_ACCOUNT_ID="$CF_ACCOUNT_ID"

DOMAIN="draftplay.ai"
WEB_CLOUD_RUN="https://draftplay-web-445576271033.asia-south1.run.app"

echo "=== DraftPlay Cloudflare Setup ==="
echo ""

# ---------------------------------------------------------------------------
# 1. Get Zone ID
# ---------------------------------------------------------------------------
echo "1. Getting zone ID for ${DOMAIN}..."
ZONE_ID=$(curl -s "https://api.cloudflare.com/client/v4/zones?name=${DOMAIN}" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['result'][0]['id'])")
echo "   Zone ID: ${ZONE_ID}"

# ---------------------------------------------------------------------------
# 2. Admin Proxy Worker (draftplay.ai + www → Cloud Run Admin)
# ---------------------------------------------------------------------------
echo ""
echo "2. Creating admin proxy worker..."

mkdir -p /tmp/cf-setup-admin-proxy
cat > /tmp/cf-setup-admin-proxy/index.js << WORKEREOF
const ORIGIN = "${WEB_CLOUD_RUN}";

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const newUrl = new URL(url.pathname + url.search, ORIGIN);
    const newRequest = new Request(newUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: "follow",
    });
    newRequest.headers.set("Host", new URL(ORIGIN).hostname);
    return fetch(newRequest);
  },
};
WORKEREOF

cat > /tmp/cf-setup-admin-proxy/wrangler.toml << TOMLEOF
name = "draftplay-admin-proxy"
main = "index.js"
compatibility_date = "2024-01-01"
workers_dev = false
TOMLEOF

cd /tmp/cf-setup-admin-proxy && npx wrangler@latest deploy --quiet 2>&1 | tail -3
echo "   Admin proxy worker deployed"

# Attach draftplay.ai and www.draftplay.ai
for subdomain in "" "www."; do
  hostname="${subdomain}${DOMAIN}"
  curl -s -X PUT "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/workers/domains" \
    -H "Authorization: Bearer ${CF_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "{\"hostname\": \"${hostname}\", \"service\": \"draftplay-admin-proxy\", \"zone_id\": \"${ZONE_ID}\", \"environment\": \"production\"}" \
    | python3 -c "import json,sys; d=json.load(sys.stdin); print('   ${hostname}:', 'OK' if d['success'] else d['errors'])"
done

# ---------------------------------------------------------------------------
# 3. App Pages Project (app.draftplay.ai)
# ---------------------------------------------------------------------------
echo ""
echo "3. Creating Cloudflare Pages project..."

# Create project (idempotent — 409 if exists)
CREATE_RESULT=$(curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/pages/projects" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{"name": "draftplay-app", "production_branch": "main"}')

SUCCESS=$(echo "$CREATE_RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['success'])" 2>/dev/null || echo "False")
if [[ "$SUCCESS" == "True" ]]; then
  echo "   Pages project created: draftplay-app.pages.dev"
else
  echo "   Pages project already exists (OK)"
fi

# Add custom domain
curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/pages/projects/draftplay-app/domains" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data "{\"name\": \"app.${DOMAIN}\"}" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print('   app.${DOMAIN}:', 'OK' if d['success'] else 'already configured')" 2>/dev/null || echo "   app.${DOMAIN}: already configured"

# ---------------------------------------------------------------------------
# 4. DNS Records
# ---------------------------------------------------------------------------
echo ""
echo "4. Ensuring DNS records..."

# app.draftplay.ai → Pages (CNAME)
EXISTING=$(curl -s "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records?name=app.${DOMAIN}&type=CNAME" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  | python3 -c "import json,sys; print(len(json.load(sys.stdin)['result']))")

if [[ "$EXISTING" == "0" ]]; then
  curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" \
    -H "Authorization: Bearer ${CF_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "{\"type\": \"CNAME\", \"name\": \"app\", \"content\": \"draftplay-app.pages.dev\", \"proxied\": true}" \
    | python3 -c "import json,sys; d=json.load(sys.stdin); print('   app.${DOMAIN} CNAME:', 'created' if d['success'] else d['errors'])"
else
  echo "   app.${DOMAIN} CNAME: already exists"
fi

# ---------------------------------------------------------------------------
# 5. Verify
# ---------------------------------------------------------------------------
echo ""
echo "5. Verifying..."
sleep 3

API_URL="https://draftplay-api-445576271033.asia-south1.run.app"
for url in "${API_URL}/health" "https://${DOMAIN}" "https://www.${DOMAIN}" "https://app.${DOMAIN}"; do
  STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
  echo "   ${url} → HTTP ${STATUS}"
done

echo ""
echo "=== Cloudflare setup complete ==="
echo ""
echo "Architecture:"
echo "  API                → Cloud Run directly (no proxy)"
echo "  draftplay.ai       → CF Worker proxy → Cloud Run Admin (Next.js)"
echo "  www.draftplay.ai   → CF Worker proxy → Cloud Run Admin (Next.js)"
echo "  app.draftplay.ai   → CF Pages (Expo static export)"
echo ""
echo "Deploy commands:"
echo "  ./scripts/deploy-api.sh <version>   # API → Cloud Run"
echo "  ./scripts/deploy-web.sh <version>   # Admin → Cloud Run"
echo "  ./scripts/deploy-app.sh <version>   # App → Cloudflare Pages"
