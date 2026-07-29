#!/usr/bin/env bash
# Fail if any tracked *.sh has CR (CRLF) or is a non-empty file with zero newlines.
# Usage: bash scripts/ci/check-shell-lf.sh
# Optional: bash scripts/ci/check-shell-lf.sh --fix  (strip trailing CR, then re-check)

set -euo pipefail

fix=0
if [[ "${1:-}" == "--fix" ]]; then
  fix=1
fi

root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$root"

mapfile -d '' files < <(git ls-files -z -- '*.sh')
if [[ ${#files[@]} -eq 0 ]]; then
  echo "check-shell-lf: no tracked *.sh files"
  exit 0
fi

if [[ "$fix" -eq 1 ]]; then
  for f in "${files[@]}"; do
    [[ -n "$f" && -f "$f" ]] || continue
    if grep -q $'\r' "$f" 2>/dev/null; then
      sed -i 's/\r$//' "$f"
      echo "check-shell-lf: stripped CR from $f"
    fi
  done
fi

failed=0
for f in "${files[@]}"; do
  [[ -n "$f" && -f "$f" ]] || continue
  lines="$(wc -l < "$f" | tr -d '[:space:]')"
  if [[ -s "$f" && "${lines:-0}" -eq 0 ]]; then
    echo "check-shell-lf: ERROR: $f has content but no newlines (corrupt / newline-stripped)"
    failed=1
  fi
  if grep -q $'\r' "$f" 2>/dev/null; then
    echo "check-shell-lf: ERROR: $f contains CR (convert to LF; see .gitattributes)"
    failed=1
  fi
done

if [[ "$failed" -ne 0 ]]; then
  echo "check-shell-lf: failed — shell scripts must be LF-only with real newlines"
  exit 1
fi

echo "check-shell-lf: ok (${#files[@]} scripts)"
