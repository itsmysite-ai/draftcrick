#!/usr/bin/env bash
#
# local-db.sh — Spin up an ephemeral local PostgreSQL for dev/testing
#
# Usage:
#   ./scripts/local-db.sh start   — Start pg_tmp, run migrations, print DATABASE_URL
#   ./scripts/local-db.sh stop    — Stop the ephemeral instance
#   ./scripts/local-db.sh url     — Print the current DATABASE_URL
#   ./scripts/local-db.sh migrate — Run Drizzle migrations against local DB
#   ./scripts/local-db.sh psql    — Open psql shell to local DB
#
# Requires: brew install postgresql@16 ephemeralpg

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
URL_FILE="$ROOT_DIR/.local-db-url"

# Ensure pg16 binaries are in PATH
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"

cmd_start() {
  if [[ -f "$URL_FILE" ]]; then
    local existing_url
    existing_url=$(cat "$URL_FILE")
    # Check if the DB is still alive
    if psql "$existing_url" -c "SELECT 1" &>/dev/null; then
      echo "Local DB already running: $existing_url"
      return 0
    else
      rm -f "$URL_FILE"
    fi
  fi

  echo "Starting ephemeral PostgreSQL..."
  # -w 10 = wait up to 10s for DB to be ready, -t = use TCP socket
  local db_url
  db_url=$(pg_tmp -w 10 -t)

  echo "$db_url" > "$URL_FILE"
  echo "Local DB started: $db_url"

  # Run migrations
  cmd_migrate
}

cmd_stop() {
  if [[ -f "$URL_FILE" ]]; then
    local url
    url=$(cat "$URL_FILE")
    # Extract port and send stop signal
    echo "Stopping ephemeral PostgreSQL..."
    # pg_tmp DBs auto-stop, but we can force it by connecting and telling it to stop
    # The simplest way: just remove the URL file and let the timeout handle cleanup
    rm -f "$URL_FILE"
    echo "Local DB reference removed (instance will auto-terminate after idle timeout)."
  else
    echo "No local DB running."
  fi
}

cmd_url() {
  if [[ -f "$URL_FILE" ]]; then
    cat "$URL_FILE"
  else
    echo "No local DB running. Run: ./scripts/local-db.sh start" >&2
    exit 1
  fi
}

cmd_migrate() {
  local db_url
  if [[ -f "$URL_FILE" ]]; then
    db_url=$(cat "$URL_FILE")
  else
    echo "No local DB running. Run: ./scripts/local-db.sh start" >&2
    exit 1
  fi

  echo "Running Drizzle push to apply schema..."
  cd "$ROOT_DIR/packages/db"
  DATABASE_URL="$db_url" npx drizzle-kit push --force 2>&1
  echo "Schema applied successfully."
}

cmd_psql() {
  local db_url
  if [[ -f "$URL_FILE" ]]; then
    db_url=$(cat "$URL_FILE")
  else
    echo "No local DB running. Run: ./scripts/local-db.sh start" >&2
    exit 1
  fi

  psql "$db_url"
}

case "${1:-start}" in
  start)   cmd_start ;;
  stop)    cmd_stop ;;
  url)     cmd_url ;;
  migrate) cmd_migrate ;;
  psql)    cmd_psql ;;
  *)
    echo "Usage: $0 {start|stop|url|migrate|psql}"
    exit 1
    ;;
esac
