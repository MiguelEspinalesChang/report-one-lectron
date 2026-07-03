#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../apps/python-service"

if [ ! -x .venv/bin/pytest ]; then
  echo "warning: python venv not set up (run 'pnpm setup:python'); skipping pytest." >&2
  exit 0
fi

.venv/bin/pytest -q
