#!/usr/bin/env python3
"""Local stand-ins used to exercise the native Next.js routes without real services.

  :5055  Flask stand-in  - answers every path with "FLASK-STUB <path>"
  :5056  Supabase stand-in - PostgREST guidebook lookups from the parity fixtures + /auth/v1/user
Run the checks with tests/integration/native-routes.sh.
"""
import json
import sys
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

FIXTURES = Path(__file__).resolve().parents[1] / "parity" / "fixtures"
ROWS = {p.stem: json.loads(p.read_text()) for p in FIXTURES.glob("*.json")}

# An active guidebook, a draft with a share token, and one that makes the lookup fail.
ACTIVE = dict(ROWS["full_original"], public_slug="cozy-cabin-abc123", active=True)
DRAFT = dict(ROWS["minimal_original"], id="draft-1", active=False, public_slug=None,
             preview_token="s3cret-token", user_id="owner-1",
             property={"id": 9, "name": "Draft House", "address_street": None, "address_city_state": None, "address_zip": None})
BROKEN = dict(ACTIVE, id="broken-1", public_slug="broken-slug")
TOKENS = {"owner-token": "owner-1", "other-token": "someone-else"}


class Flask(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(f"FLASK-STUB {self.path}".encode())

    do_POST = do_GET

    def log_message(self, *a):
        pass


class Supabase(BaseHTTPRequestHandler):
    fail_all = False

    def _send(self, status, body):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        url = urlparse(self.path)
        qs = {k: v[0] for k, v in parse_qs(url.query).items()}
        if url.path == "/auth/v1/user":
            token = (self.headers.get("Authorization") or "").replace("Bearer ", "")
            if token in TOKENS:
                return self._send(200, {"id": TOKENS[token], "email": f"{TOKENS[token]}@example.com", "aud": "authenticated"})
            return self._send(401, {"message": "invalid"})
        if url.path == "/rest/v1/guidebook":
            if "broken" in json.dumps(qs):
                return self._send(500, {"message": "boom"})
            rows = [ACTIVE, DRAFT]
            for key, cond in qs.items():
                if not cond.startswith("eq."):
                    continue
                want = cond[3:]
                rows = [r for r in rows if str(r.get(key)).lower() == want.lower()] if key in ("public_slug", "id", "active") else rows
            return self._send(200, rows[:1])
        return self._send(404, {"message": "not found"})

    def log_message(self, *a):
        pass


def serve(port, handler):
    HTTPServer(("127.0.0.1", port), handler).serve_forever()


if __name__ == "__main__":
    threading.Thread(target=serve, args=(5055, Flask), daemon=True).start()
    serve(5056, Supabase)
