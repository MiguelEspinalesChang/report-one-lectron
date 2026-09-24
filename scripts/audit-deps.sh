#!/usr/bin/env bash
# Audits dependencies for known vulnerabilities in both ecosystems.
# JS/TS: pnpm audit (GitHub Advisory Database). Python: pip-audit (PyPI / OSV).
# Fails on high or critical JS advisories and on any Python advisory.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> pnpm audit (high+)"
(cd "$ROOT" && pnpm audit --audit-level=high)

echo "==> pip-audit (apps/python-service)"
PIP_AUDIT="$ROOT/apps/python-service/.venv/bin/pip-audit"
if [ ! -x "$PIP_AUDIT" ]; then
  echo "error: pip-audit not found in the python venv (run 'pnpm setup:python')." >&2
  exit 1
fi
"$PIP_AUDIT" --skip-editable
