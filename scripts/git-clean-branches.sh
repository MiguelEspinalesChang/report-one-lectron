#!/usr/bin/env bash
# Deletes local branches whose remote counterpart is gone
# (i.e. merged PRs whose branch GitHub auto-deleted).
set -euo pipefail

git fetch --prune

deleted=0
while read -r branch status; do
  case "$branch" in
    main | develop) continue ;;
  esac
  if [ "${status:-}" = "[gone]" ]; then
    git branch -D "$branch"
    deleted=$((deleted + 1))
  fi
done < <(git for-each-ref --format='%(refname:short) %(upstream:track)' refs/heads)

echo "Remote refs pruned; deleted $deleted local branch(es) whose upstream is gone."
