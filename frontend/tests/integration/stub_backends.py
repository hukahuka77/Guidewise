#!/usr/bin/env python3
"""Local stand-in used to exercise the Next.js routes without real services.

  :5056  Supabase stand-in - PostgREST guidebook lookups from the parity fixtures + /auth/v1/user
Run the checks with tests/integration/native-routes.sh.
"""
import json
import os
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

FIXTURES = Path(__file__).resolve().parents[1] / "parity" / "fixtures"
ROWS = {p.stem: json.loads(p.read_text()) for p in FIXTURES.glob("*.json")}

# A guidebook, and a slug that makes the lookup fail.
ACTIVE = dict(ROWS["full_original"], public_slug="cozy-cabin-abc123")
# Optional extra rows (a JSON list in the PostgREST shape) so pages can be checked for guidebooks created in the
# test database: STUB_ROWS=/path/rows.json
EXTRA_ROWS_FILE = os.environ.get("STUB_ROWS")


def extra_rows():
    if EXTRA_ROWS_FILE and Path(EXTRA_ROWS_FILE).exists():
        return json.loads(Path(EXTRA_ROWS_FILE).read_text())
    return []
OWNER_ID = "11111111-1111-4111-8111-aaaaaaaaaaaa"
OTHER_ID = "22222222-2222-4222-8222-bbbbbbbbbbbb"
GUEST_ID = "33333333-3333-4333-8333-cccccccccccc"
TOKENS = {"owner-token": OWNER_ID, "other-token": OTHER_ID, "guest-token": GUEST_ID}


def user_for(token):
    uid = TOKENS[token]
    guest = uid == GUEST_ID
    return {"id": uid, "email": None if guest else f"{uid}@example.com", "aud": "authenticated", "role": "authenticated",
            "is_anonymous": guest, "app_metadata": {}, "user_metadata": {}, "created_at": "2026-01-01T00:00:00Z"}


def session_for(token):
    import time
    return {"access_token": token, "refresh_token": f"refresh-{token}", "token_type": "bearer", "expires_in": 3600,
            "expires_at": int(time.time()) + 3600, "user": user_for(token)}


class Supabase(BaseHTTPRequestHandler):
    fail_all = False

    def _send(self, status, body):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):  # CORS preflight from the browser
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
        self.end_headers()

    def do_GET(self):
        url = urlparse(self.path)
        qs = {k: v[0] for k, v in parse_qs(url.query).items()}
        if url.path == "/auth/v1/user":
            token = (self.headers.get("Authorization") or "").replace("Bearer ", "")
            if token in TOKENS:
                return self._send(200, user_for(token))
            return self._send(401, {"message": "invalid"})
        if url.path == "/rest/v1/guidebook":
            if "broken" in json.dumps(qs):
                return self._send(500, {"message": "boom"})
            rows = [ACTIVE] + extra_rows()
            for key, cond in qs.items():
                if not cond.startswith("eq."):
                    continue
                want = cond[3:]
                rows = [r for r in rows if str(r.get(key)).lower() == want.lower()] if key in ("public_slug", "id") else rows
            return self._send(200, rows[:1])
        return self._send(404, {"message": "not found"})

    def do_POST(self):
        url = urlparse(self.path)
        length = int(self.headers.get("Content-Length") or 0)
        body = json.loads(self.rfile.read(length) or b"{}")
        # Sign-up without an email is an anonymous (guest) sign-in; with one it creates the owner's account
        if url.path == "/auth/v1/signup":
            # STUB_ANON_OFF=/path/flag: while that file exists, anonymous sign-ins are switched off (as in Supabase)
            anon_off = os.environ.get("STUB_ANON_OFF")
            if not body.get("email") and anon_off and Path(anon_off).exists():
                return self._send(422, {"code": 422, "error_code": "anonymous_provider_disabled", "msg": "Anonymous sign-ins are disabled"})
            return self._send(200, session_for("owner-token" if body.get("email") else "guest-token"))
        if url.path == "/auth/v1/token":
            return self._send(200, session_for("owner-token"))
        if url.path == "/auth/v1/logout":
            return self._send(204, {})
        return self._send(404, {"message": "not found"})

    def do_DELETE(self):
        if self.path.startswith("/auth/v1/admin/users/"):
            return self._send(200, {})
        return self._send(404, {"message": "not found"})

    def log_message(self, *a):
        pass


def serve(port, handler):
    HTTPServer(("127.0.0.1", port), handler).serve_forever()


if __name__ == "__main__":
    serve(5056, Supabase)
