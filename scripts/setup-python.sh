#!/usr/bin/env bash
# Creates the python-service virtualenv with dev tooling (pytest, ruff).
set -euo pipefail

cd "$(dirname "$0")/../apps/python-service"

PYTHON_BIN="${PYTHON_BIN:-}"
if [ -z "$PYTHON_BIN" ]; then
  for candidate in python3.13 python3.12 python3.11; do
    if command -v "$candidate" >/dev/null 2>&1; then
      PYTHON_BIN="$candidate"
      break
    fi
  done
fi

if [ -z "$PYTHON_BIN" ]; then
  echo "error: Python 3.11+ not found (tried python3.13/3.12/3.11)." >&2
  echo "Install it first, e.g.: brew install python@3.12" >&2
  exit 1
fi

"$PYTHON_BIN" -m venv .venv
.venv/bin/pip install --upgrade pip >/dev/null
.venv/bin/pip install -e ".[dev]"
echo "python-service venv ready: $(.venv/bin/python --version)"
