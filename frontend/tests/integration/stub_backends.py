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
TOKENS = {"owner-token": OWNER_ID, "other-token": OTHER_ID}


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
                return self._send(200, {"id": TOKENS[token], "email": f"{TOKENS[token]}@example.com", "aud": "authenticated"})
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

    def log_message(self, *a):
        pass


def serve(port, handler):
    HTTPServer(("127.0.0.1", port), handler).serve_forever()


if __name__ == "__main__":
    serve(5056, Supabase)
