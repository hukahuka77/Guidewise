#!/usr/bin/env bash
# End-to-end check of the native guidebook routes against local stand-ins for Flask and Supabase.
# Usage (from frontend/): bash tests/integration/native-routes.sh
set -u
cd "$(dirname "$0")/../.."
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); printf "  ok   %s\n" "$1"; }
bad()  { FAIL=$((FAIL+1)); printf "  FAIL %s (%s)\n" "$1" "$2"; }
expect() { [ "$2" = "$3" ] && ok "$1" || bad "$1" "expected '$3', got '$2'"; }
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }

port_busy() { (exec 3<>/dev/tcp/127.0.0.1/"$1") 2>/dev/null; }
for p in 3056 3057 3058 5055 5056; do
  if port_busy $p; then echo "port $p is already in use; stop the other process and re-run"; exit 2; fi
done

# Each server runs in its own process group so cleanup also stops the children npx spawns.
setsid python3 tests/integration/stub_backends.py >/tmp/stubs.log 2>&1 & STUBS=$!
NEXT=
stop_next() { [ -n "$NEXT" ] && kill -TERM -- "-$NEXT" 2>/dev/null; NEXT=; sleep 1; }
cleanup() { stop_next; kill -TERM -- "-$STUBS" 2>/dev/null; }
trap cleanup EXIT

start_next() { # port, env...
  local port=$1; shift
  setsid env BACKEND_URL=http://127.0.0.1:5055 NEXT_TELEMETRY_DISABLED=1 "$@" npx next dev -p "$port" >/tmp/next-$port.log 2>&1 & NEXT=$!
  for _ in $(seq 1 60); do curl -s -o /dev/null "http://127.0.0.1:$port/api/health" && return 0; sleep 2; done
  echo "next dev did not start"; cat /tmp/next-$port.log | tail -20; exit 1
}

echo "== configured (service-role key present)"
B=http://127.0.0.1:3056
start_next 3056 SUPABASE_URL=http://127.0.0.1:5056 SUPABASE_SERVICE_ROLE_KEY=test-key NEXT_PUBLIC_SITE_URL=https://www.example.com
expect "native /api/health"                    "$(curl -s $B/api/health | head -c 11)" '{"ok":true,'
expect "active guidebook page"                 "$(code $B/g/cozy-cabin-abc123)" 200
curl -s $B/g/cozy-cabin-abc123 > /tmp/native_g.html
if [ "$(python3 -c "print(open('/tmp/native_g.html').read().rstrip('\n')==open('tests/parity/golden/full_original__wm0.html').read().rstrip('\n'))")" = "True" ]; then ok "page identical to Flask golden"; else bad "page identical to Flask golden" differs; fi
expect "unknown slug"                          "$(code $B/g/nope)" 404
ETAG=$(curl -s -D - -o /dev/null $B/g/cozy-cabin-abc123 | tr -d '\r' | awk -F': ' 'tolower($1)=="etag"{print $2}')
expect "If-None-Match -> 304"                  "$(code -H "If-None-Match: $ETAG" $B/g/cozy-cabin-abc123)" 304
expect "draft preview, no token"               "$(code $B/preview/draft-1)" 404
expect "draft preview, wrong token"            "$(code "$B/preview/draft-1?t=wrong")" 404
expect "draft preview, right token"            "$(code "$B/preview/draft-1?t=s3cret-token")" 200
expect "draft preview, owner bearer"           "$(code -H 'Authorization: Bearer owner-token' $B/preview/draft-1)" 200
expect "draft preview, other user's bearer"    "$(code -H 'Authorization: Bearer other-token' $B/preview/draft-1)" 404
expect "legacy /guidebook inactive redirects"  "$(curl -s -o /dev/null -w '%{http_code}' $B/guidebook/draft-1)" 302
expect "lookup error falls back to Flask"      "$(curl -s $B/g/broken-slug | head -c 11)" "FLASK-STUB "
expect "unmigrated API proxied to Flask"       "$(curl -s $B/api/guidebooks/activate_for_user -X POST | head -c 11)" "FLASK-STUB "
expect "unmigrated nested API proxied"         "$(curl -s $B/api/billing/summary | head -c 11)" "FLASK-STUB "
stop_next

echo "== API routes without DATABASE_URL (must fall back to Flask)"
B=http://127.0.0.1:3057
start_next 3057 SUPABASE_URL=http://127.0.0.1:5056 SUPABASE_SERVICE_ROLE_KEY=test-key
for path in /api/guidebooks /api/hosts /api/guidebooks/abc; do
  expect "GET $path falls back"                "$(curl -s $B$path | head -c 11)" "FLASK-STUB "
done
expect "POST /api/generate falls back"         "$(curl -s -X POST $B/api/generate | head -c 11)" "FLASK-STUB "
stop_next

echo "== nothing configured at all"
B=http://127.0.0.1:3058
start_next 3058
expect "/g falls back to Flask"                "$(curl -s $B/g/cozy-cabin-abc123 | head -c 11)" "FLASK-STUB "
expect "/preview falls back to Flask"          "$(curl -s "$B/preview/draft-1?t=x" | head -c 11)" "FLASK-STUB "

echo; echo "passed: $PASS  failed: $FAIL"
[ "$FAIL" = 0 ]
