#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKIP_INSTALL=0

usage() {
  cat <<'EOF'
Usage: scripts/check.sh [--skip-install]

Runs the local verification contract for Guidewise agent work:
  1. frontend npm ci
  2. frontend lint
  3. frontend typecheck
  4. frontend production build with local defaults
  5. backend Python compile check
  6. backend Flask smoke check

Options:
  --skip-install  Skip frontend npm ci when dependencies are already installed.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-install)
      SKIP_INSTALL=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

run_step() {
  local name="$1"
  shift
  echo
  echo "==> ${name}"
  "$@"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 127
  fi
}

require_command npm
require_command python3

if [[ "$SKIP_INSTALL" -eq 0 ]]; then
  run_step "Install frontend dependencies" bash -lc "cd '$ROOT_DIR/frontend' && npm ci"
fi

run_step "Lint frontend" bash -lc "cd '$ROOT_DIR/frontend' && npm run lint"
run_step "Typecheck frontend" bash -lc "cd '$ROOT_DIR/frontend' && npm run typecheck"
run_step "Build frontend" bash -lc "cd '$ROOT_DIR/frontend' && NEXT_PUBLIC_API_BASE_URL=\${NEXT_PUBLIC_API_BASE_URL:-http://localhost:5001} NEXT_PUBLIC_SITE_URL=\${NEXT_PUBLIC_SITE_URL:-http://localhost:3000} npm run build"
run_step "Compile backend" bash -lc "cd '$ROOT_DIR/backend' && python3 -m compileall ."
run_step "Smoke check backend" bash -lc "cd '$ROOT_DIR/backend' && python3 smoke_check.py"

echo
echo "All Guidewise checks passed."
