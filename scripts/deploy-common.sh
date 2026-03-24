#!/usr/bin/env bash
# ===========================================
# Shared deploy helper — sourced by all deploy scripts
# ===========================================
# Reads .env.production, sets GCP project, builds on Cloud Build (no local Docker needed).
# All deploy scripts just: source "$(dirname "$0")/deploy-common.sh"

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env.production"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: .env.production not found. Create it with your production credentials."
  exit 1
fi

# ---- Load vars from .env.production ----
set -a
while IFS= read -r line; do
  [[ -z "$line" || "$line" =~ ^# ]] && continue
  key=$(echo "$line" | cut -d'=' -f1)
  val=$(echo "$line" | cut -d'=' -f2-)
  [[ -z "$val" ]] && continue
  export "$key=$val"
done < "$ENV_FILE"
set +a

# ---- Validate GCP config ----
if [[ -z "${GCP_PROJECT_ID:-}" ]]; then
  echo "ERROR: GCP_PROJECT_ID is not set in .env.production"
  exit 1
fi

REGION="${GCP_REGION:-asia-south1}"
REGISTRY="${REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/draftplay"

# ---- Switch GCP account + project (handles multi-account laptops) ----
if [[ -n "${GCP_ACCOUNT:-}" ]]; then
  echo "   GCP account: ${GCP_ACCOUNT}"
  gcloud config set account "$GCP_ACCOUNT" --quiet 2>/dev/null
fi
echo "   GCP project: ${GCP_PROJECT_ID}"
gcloud config set project "$GCP_PROJECT_ID" --quiet 2>/dev/null

# ---- Ensure Artifact Registry repo exists (idempotent) ----
if ! gcloud artifacts repositories describe draftplay \
  --location="$REGION" --format="value(name)" &>/dev/null; then
  echo "   Creating Artifact Registry repo..."
  gcloud artifacts repositories create draftplay \
    --repository-format=docker \
    --location="$REGION" \
    --quiet
fi

# ---- Git helpers ----
create_release_branch() {
  local version="$1"
  local skip="${2:-false}"

  if [[ "$skip" == true ]]; then
    echo "1. Skipping branch creation"
    return
  fi

  echo "1. Creating release branch..."
  local branch="release/v${version}"
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "   WARNING: Uncommitted changes."
    read -rp "   Continue? (y/N) " confirm
    [[ "$confirm" == "y" ]] || exit 1
  fi
  git checkout -b "$branch" 2>/dev/null || git checkout "$branch"
  git tag -a "v${version}" -m "Release v${version}" 2>/dev/null || true
  git push origin "$branch" --tags
  echo "   Branch: $branch"
}

# ---- Cloud Build helper ----
# Builds Docker image on GCP Cloud Build (no local Docker needed)
cloud_build() {
  local dockerfile="$1"
  local image="$2"
  local version="$3"
  shift 3
  local substitutions="${*:-}"

  echo "   Building on Cloud Build (no local Docker needed)..."

  # Generate cloudbuild.yaml with build args
  local build_args_yaml=""
  if [[ -n "$substitutions" ]]; then
    IFS=',' read -ra PAIRS <<< "$substitutions"
    for pair in "${PAIRS[@]}"; do
      local key=$(echo "$pair" | cut -d'=' -f1)
      local val=$(echo "$pair" | cut -d'=' -f2-)
      build_args_yaml="${build_args_yaml}      - '--build-arg=${key#_}=${val}'"$'\n'
    done
  fi

  local config_file="/tmp/cloudbuild-$$.yaml"
  cat > "$config_file" <<YAML
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-f'
      - '${dockerfile}'
${build_args_yaml}      - '-t'
      - '${image}:v${version}'
      - '-t'
      - '${image}:latest'
      - '.'
images:
  - '${image}:v${version}'
  - '${image}:latest'
timeout: 1200s
options:
  machineType: 'E2_HIGHCPU_8'
YAML

  gcloud builds submit "${ROOT_DIR}" \
    --config "$config_file" \
    --quiet

  rm -f "$config_file"
  echo "   Built and pushed: ${image}:v${version}"
}

# ---- Build arg helpers (for Cloud Build substitutions) ----
get_expo_substitutions() {
  local subs=""
  while IFS= read -r line; do
    [[ -z "$line" || "$line" =~ ^# ]] && continue
    [[ ! "$line" =~ ^EXPO_PUBLIC_ ]] && continue
    local key=$(echo "$line" | cut -d'=' -f1)
    local val=$(echo "$line" | cut -d'=' -f2-)
    [[ -z "$val" ]] && continue
    if [[ -n "$subs" ]]; then
      subs="${subs},_${key}=${val}"
    else
      subs="_${key}=${val}"
    fi
  done < "$ENV_FILE"
  echo "$subs"
}

get_next_substitutions() {
  local subs=""
  while IFS= read -r line; do
    [[ -z "$line" || "$line" =~ ^# ]] && continue
    [[ ! "$line" =~ ^NEXT_PUBLIC_ ]] && continue
    local key=$(echo "$line" | cut -d'=' -f1)
    local val=$(echo "$line" | cut -d'=' -f2-)
    [[ -z "$val" ]] && continue
    if [[ -n "$subs" ]]; then
      subs="${subs},_${key}=${val}"
    else
      subs="_${key}=${val}"
    fi
  done < "$ENV_FILE"
  echo "$subs"
}

get_server_env_file() {
  local env_file="/tmp/cloudrun-env-$$.yaml"
  echo "# Auto-generated Cloud Run env vars" > "$env_file"
  while IFS= read -r line; do
    [[ -z "$line" || "$line" =~ ^# ]] && continue
    [[ "$line" =~ ^EXPO_PUBLIC_ ]] && continue
    [[ "$line" =~ ^NEXT_PUBLIC_ ]] && continue
    [[ "$line" =~ ^GCP_ACCOUNT ]] && continue
    [[ "$line" =~ ^GCP_REGION ]] && continue
    [[ "$line" =~ ^PORT= ]] && continue
    local key=$(echo "$line" | cut -d'=' -f1)
    local val=$(echo "$line" | cut -d'=' -f2-)
    [[ -z "$val" ]] && continue
    echo "${key}: \"${val}\"" >> "$env_file"
  done < "$ENV_FILE"
  echo "$env_file"
}

verify_deployment() {
  local service="$1"
  local version="$2"
  echo ""
  echo "4. Verifying..."
  local url
  url=$(gcloud run services describe "$service" --region="$REGION" --format='value(status.url)')
  echo "   URL: $url"
  sleep 5
  local path="${3:-/health}"
  if curl -sf "${url}${path}" -o /dev/null -w "   HTTP %{http_code}\n"; then
    echo ""
    echo "=== ${service} v${version} DEPLOYED ==="
  else
    echo ""
    echo "=== WARNING: Health check failed ==="
    echo "   gcloud run logs read --service=$service --region=$REGION --limit=20"
  fi
}
