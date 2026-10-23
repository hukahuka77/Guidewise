#!/usr/bin/env bash
# End-to-end check of the guidebook routes against a local Supabase stand-in and PGlite.
# Usage (from frontend/): bash tests/integration/native-routes.sh
set -u
cd "$(dirname "$0")/../.."
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); printf "  ok   %s\n" "$1"; }
bad()  { FAIL=$((FAIL+1)); printf "  FAIL %s (%s)\n" "$1" "$2"; }
expect() { [ "$2" = "$3" ] && ok "$1" || bad "$1" "expected '$3', got '$2'"; }
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }

port_busy() { (exec 3<>/dev/tcp/127.0.0.1/"$1") 2>/dev/null; }
for p in 3056 3057 3058 3059 5056 5440; do
  if port_busy $p; then echo "port $p is already in use; stop the other process and re-run"; exit 2; fi
done

# Each server runs in its own process group so cleanup also stops the children npx spawns.
setsid python3 tests/integration/stub_backends.py >/tmp/stubs.log 2>&1 & STUBS=$!
setsid node tests/integration/pglite_server.mjs 5440 >/tmp/pglite.log 2>&1 & PGL=$!
for _ in $(seq 1 30); do port_busy 5440 && break; sleep 1; done
NEXT=
stop_next() { [ -n "$NEXT" ] && kill -TERM -- "-$NEXT" 2>/dev/null; NEXT=; sleep 1; }
cleanup() { stop_next; kill -TERM -- "-$STUBS" 2>/dev/null; kill -TERM -- "-$PGL" 2>/dev/null; }
trap cleanup EXIT

start_next() { # port, env...
  local port=$1; shift
  setsid env NEXT_TELEMETRY_DISABLED=1 "$@" npx next dev -p "$port" >/tmp/next-$port.log 2>&1 & NEXT=$!
  for _ in $(seq 1 60); do curl -s -o /dev/null "http://127.0.0.1:$port/api/health" && return 0; sleep 2; done
  echo "next dev did not start"; cat /tmp/next-$port.log | tail -20; exit 1
}

echo "== configured (service-role key present)"
B=http://127.0.0.1:3056
start_next 3056 SUPABASE_URL=http://127.0.0.1:5056 SUPABASE_SERVICE_ROLE_KEY=test-key NEXT_PUBLIC_SITE_URL=https://www.example.com
expect "native /api/health"                    "$(curl -s $B/api/health | head -c 11)" '{"ok":true,'
expect "guidebook page"                        "$(code $B/g/cozy-cabin-abc123)" 200
curl -s $B/g/cozy-cabin-abc123 > /tmp/native_g.html
if [ "$(python3 -c "print(open('/tmp/native_g.html').read().rstrip('\n')==open('tests/parity/golden/full_original.html').read().rstrip('\n'))")" = "True" ]; then ok "page identical to its golden snapshot"; else bad "page identical to its golden snapshot" differs; fi
expect "direct-by-id page (printed QR codes)"   "$(code $B/guidebook/$(python3 -c "import json;print(json.load(open('tests/parity/fixtures/full_original.json'))['id'])"))" 200
expect "unknown slug"                          "$(code $B/g/nope)" 404
ETAG=$(curl -s -D - -o /dev/null $B/g/cozy-cabin-abc123 | tr -d '\r' | awk -F': ' 'tolower($1)=="etag"{print $2}')
expect "If-None-Match -> 304"                  "$(code -H "If-None-Match: $ETAG" $B/g/cozy-cabin-abc123)" 304
expect "lookup error -> 500, not cached"        "$(code $B/g/broken-slug)" 500
expect "unknown API path -> 404"               "$(code $B/api/does-not-exist)" 404
stop_next

echo "== authenticated API routes against a real database"
B=http://127.0.0.1:3059
start_next 3059 SUPABASE_URL=http://127.0.0.1:5056 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:5056 NEXT_PUBLIC_SUPABASE_ANON_KEY=anon SUPABASE_SERVICE_ROLE_KEY=test-key \
  "DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5440/postgres?sslmode=disable"
O='Authorization: Bearer owner-token'; X='Authorization: Bearer other-token'; J='Content-Type: application/json'
pyjson() { python3 -c "import json,sys;d=json.load(sys.stdin);print($1)"; }
expect "no token -> 401"                       "$(code $B/api/guidebooks)" 401
expect "bad token -> 401"                      "$(code -H 'Authorization: Bearer nope' $B/api/guidebooks)" 401
CREATED=$(curl -s -D /tmp/gen.hdr -X POST $B/api/generate -H "$O" -H "$J" -d '{"property_name":"E2E Cabin","host_name":"Andrew","welcome_message":"hello","rules":["No pets: ask"]}')
GID=$(echo "$CREATED" | pyjson "d.get('guidebook_id','')")
expect "POST /api/generate -> 201"             "$(head -1 /tmp/gen.hdr | tr -d '\r' | awk '{print $2}')" 201
expect "new guidebook is live at its URL"   "$(grep -i '^x-guidebook-url' /tmp/gen.hdr | tr -d '\r' | sed -E 's/.*: (\/g\/e2e-cabin)-.*/\1/')" "/g/e2e-cabin"
expect "GET /api/guidebooks lists it"          "$(curl -s $B/api/guidebooks -H "$O" | pyjson "[i['property_name'] for i in d['items']]")" "['E2E Cabin']"
expect "other user's list is empty"            "$(curl -s $B/api/guidebooks -H "$X" | pyjson "d['items']")" "[]"
expect "GET /api/guidebooks/:id"               "$(curl -s $B/api/guidebooks/$GID -H "$O" | pyjson "d['welcome_message'] + ' ' + d['rules'][0]['name']")" "hello No pets"
expect "other user GET -> 404"                 "$(code $B/api/guidebooks/$GID -H "$X")" 404
expect "PATCH /api/guidebooks/:id"             "$(curl -s -X PATCH $B/api/guidebooks/$GID -H "$O" -H "$J" -d '{"welcome_message":"patched"}')" "{\"ok\":true,\"guidebook_id\":\"$GID\"}"
expect "PUT works too"                         "$(code -X PUT $B/api/guidebooks/$GID -H "$O" -H "$J" -d '{"parking_info":"garage"}')" 200
expect "POST /api/guidebook/:id/template"      "$(curl -s -X POST $B/api/guidebook/$GID/template -H "$O" -H "$J" -d '{"template_key":"template_generic"}')" '{"ok":true,"template_key":"template_generic"}'
expect "invalid template -> 400"               "$(code -X POST $B/api/guidebook/$GID/template -H "$O" -H "$J" -d '{"template_key":"zzz"}')" 400
expect "GET /api/hosts"                        "$(curl -s $B/api/hosts -H "$O" | pyjson "[h['name'] for h in d['hosts']]")" "['Andrew']"
expect "other user DELETE -> 404"              "$(code -X DELETE $B/api/guidebooks/$GID -H "$X")" 404
expect "owner DELETE -> 200"                   "$(code -X DELETE $B/api/guidebooks/$GID -H "$O")" 200
expect "deleted -> 404"                        "$(code $B/api/guidebooks/$GID -H "$O")" 404
stop_next

echo "== API routes without DATABASE_URL (503, not configured)"
B=http://127.0.0.1:3057
start_next 3057 SUPABASE_URL=http://127.0.0.1:5056 SUPABASE_SERVICE_ROLE_KEY=test-key
for path in /api/guidebooks /api/hosts /api/guidebooks/abc; do
  expect "GET $path -> 503"                    "$(code $B$path)" 503
done
expect "POST /api/generate -> 503"             "$(code -X POST $B/api/generate)" 503
stop_next

echo "== nothing configured at all"
B=http://127.0.0.1:3058
start_next 3058
expect "/g -> 503 when not configured"         "$(code $B/g/cozy-cabin-abc123)" 503

echo; echo "passed: $PASS  failed: $FAIL"
[ "$FAIL" = 0 ]
