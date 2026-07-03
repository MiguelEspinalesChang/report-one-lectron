#!/usr/bin/env bash
# Runs ruff on staged python files (invoked by lint-staged with file paths).
set -euo pipefail

RUFF="apps/python-service/.venv/bin/ruff"
if [ ! -x "$RUFF" ]; then
  echo "warning: python venv not set up (run 'pnpm setup:python'); skipping ruff on staged files." >&2
  exit 0
fi

"$RUFF" check --fix "$@"
