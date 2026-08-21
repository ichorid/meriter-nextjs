#!/usr/bin/env bash
# Idempotently set KEY=VALUE in an env file, in place.
#
# Sourced, not executed:
#   . scripts/vps/upsert-env.sh
#   upsert_env /opt/meriter/.env VERSION_API sha-abc1234
#
# Why awk and not `sed -i "s|^KEY=.*|KEY=$value|"`: sed re-parses the replacement,
# so a value containing the delimiter, a backslash or & is corrupted or errors out.
# awk passes the value through the environment, untouched.
#
# Every occurrence of the key is rewritten, not just the first: hand-edited .env
# files on the VPS carry duplicate keys, and the LAST one wins when the file is
# loaded, so rewriting only the first would leave a stale value in charge.

upsert_env() {
  local file="${1:-}" key="${2:-}" value="${3:-}"

  if [ -z "$file" ] || [ -z "$key" ]; then
    echo "upsert_env: usage: upsert_env <file> <key> <value>" >&2
    return 2
  fi
  case "$key" in
    *[!A-Za-z0-9_]* | [0-9]*)
      echo "upsert_env: invalid env key: ${key}" >&2
      return 2
      ;;
  esac

  touch "$file"

  # A file whose last line has no newline would otherwise get the new key glued
  # onto the end of that line, where it is silently ignored on load.
  if [ -s "$file" ] && [ "$(tail -c1 "$file" | wc -l)" -eq 0 ]; then
    printf '\n' >> "$file"
  fi

  local tmp
  tmp="$(mktemp "${file}.upsert.XXXXXX")" || return 1

  if ! UPSERT_KEY="$key" UPSERT_VALUE="$value" awk '
      BEGIN { key = ENVIRON["UPSERT_KEY"]; value = ENVIRON["UPSERT_VALUE"]; found = 0 }
      index($0, key "=") == 1 { print key "=" value; found = 1; next }
      { print }
      END { if (!found) print key "=" value }
    ' "$file" > "$tmp"; then
    rm -f "$tmp"
    return 1
  fi

  # Copy over the existing file instead of renaming the temp into place. A rename
  # gives the file a new inode owned by whoever ran the script, so one root-run
  # deploy would leave .env root-owned and lock out the deploy user CI writes it as.
  # Copying keeps the original inode, owner and mode.
  if ! cp "$tmp" "$file"; then
    rm -f "$tmp"
    return 1
  fi
  rm -f "$tmp"
}
