#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../apps/python-service"

if [ ! -x .venv/bin/ruff ]; then
  echo "warning: python venv not set up (run 'pnpm setup:python'); skipping ruff." >&2
  exit 0
fi

.venv/bin/ruff check .
