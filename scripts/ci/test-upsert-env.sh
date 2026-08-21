#!/usr/bin/env bash
# Unit tests for scripts/vps/upsert-env.sh
# Usage: bash scripts/ci/test-upsert-env.sh

set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=../vps/upsert-env.sh
. "$root/scripts/vps/upsert-env.sh"

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

failures=0
check() {
  local name="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "  ok   - $name"
  else
    echo "  FAIL - $name"
    echo "         expected: $(printf '%q' "$expected")"
    echo "         actual:   $(printf '%q' "$actual")"
    failures=$((failures + 1))
  fi
}

# --- appends a key that is not present yet ---
f="$tmpdir/append.env"
printf 'A=1\n' > "$f"
upsert_env "$f" VERSION_API sha-abc1234
check "appends a missing key" "A=1
VERSION_API=sha-abc1234" "$(cat "$f")"

# --- replaces an existing key in place, keeping its position ---
f="$tmpdir/replace.env"
printf 'A=1\nVERSION_API=old\nB=2\n' > "$f"
upsert_env "$f" VERSION_API sha-abc1234
check "replaces in place" "A=1
VERSION_API=sha-abc1234
B=2" "$(cat "$f")"

# --- a file with no trailing newline must not glue the key onto the last line ---
# This is the failure mode that silently breaks authorized_keys and .env alike.
f="$tmpdir/no-eol.env"
printf 'A=1' > "$f"
upsert_env "$f" VERSION_API sha-abc1234
check "no-newline file gets its own line" "A=1
VERSION_API=sha-abc1234" "$(cat "$f")"

# --- values with shell/sed metacharacters survive verbatim ---
f="$tmpdir/meta.env"
printf 'A=1\n' > "$f"
upsert_env "$f" TRICKY 'a|b&c\d/e$f"g'"'"'h'
check "metacharacters survive" 'a|b&c\d/e$f"g'"'"'h' "$(grep '^TRICKY=' "$f" | cut -d= -f2-)"

# --- a key that is a prefix of another key must not be confused with it ---
f="$tmpdir/prefix.env"
printf 'VERSION_WEB=old-web\nVERSION_WEB_EXTRA=keep\n' > "$f"
upsert_env "$f" VERSION_WEB new-web
check "prefix key is not confused" "VERSION_WEB=new-web
VERSION_WEB_EXTRA=keep" "$(cat "$f")"

# --- commented-out keys are left alone and do not count as a match ---
f="$tmpdir/comment.env"
printf '#VERSION_API=commented\n' > "$f"
upsert_env "$f" VERSION_API sha-abc1234
check "comment is not treated as the key" "#VERSION_API=commented
VERSION_API=sha-abc1234" "$(cat "$f")"

# --- duplicate keys are all rewritten, so whichever one wins holds the new value ---
# Hand-edited .env files on the VPS really do carry duplicates.
f="$tmpdir/dupes.env"
printf 'VERSION_API=old1\nB=2\nVERSION_API=old2\n' > "$f"
upsert_env "$f" VERSION_API sha-abc1234
check "all duplicates rewritten" "VERSION_API=sha-abc1234
B=2
VERSION_API=sha-abc1234" "$(cat "$f")"

# --- creates the file when it does not exist ---
f="$tmpdir/created.env"
upsert_env "$f" VERSION_API sha-abc1234
check "creates a missing file" "VERSION_API=sha-abc1234" "$(cat "$f")"

# --- the file must be rewritten in place, not replaced ---
# A replacement gets a new inode owned by whoever ran the script; a root-run deploy
# would then leave /opt/meriter/.env root-owned and CI's deploy user could not write it.
f="$tmpdir/inode.env"
printf 'A=1\n' > "$f"
inode_before="$(stat -c '%i' "$f")"
upsert_env "$f" VERSION_API sha-abc1234
check "inode preserved (owner survives)" "$inode_before" "$(stat -c '%i' "$f")"

# --- file permissions are preserved (the .env holds secrets) ---
# Windows filesystems ignore chmod, so confirm the mode sticks before asserting on it.
probe="$tmpdir/probe"
: > "$probe"
chmod 600 "$probe"
if [ "$(stat -c '%a' "$probe")" = "600" ]; then
  f="$tmpdir/perms.env"
  printf 'A=1\n' > "$f"
  chmod 600 "$f"
  upsert_env "$f" VERSION_API sha-abc1234
  check "permissions preserved" "600" "$(stat -c '%a' "$f")"
else
  echo "  skip - permissions preserved (filesystem ignores chmod)"
fi

# --- an invalid key is a caller bug and must be rejected, not written ---
f="$tmpdir/invalid.env"
printf 'A=1\n' > "$f"
rc=0
upsert_env "$f" "BAD KEY" value 2>/dev/null || rc=$?
check "invalid key rejected" "2" "$rc"
check "invalid key left the file untouched" "A=1" "$(cat "$f")"

echo
if [ "$failures" -eq 0 ]; then
  echo "test-upsert-env: all checks passed"
else
  echo "test-upsert-env: $failures check(s) failed"
  exit 1
fi
