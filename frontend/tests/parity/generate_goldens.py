#!/usr/bin/env python3
"""Render every fixture through the REAL Flask/Jinja code path and save golden HTML.

Run from the repository root with the backend dependencies installed:
    python3 frontend/tests/parity/generate_goldens.py
The Next.js (Nunjucks) renderer must produce the same HTML (see guidebook.parity.test.ts).
Remove this harness once the Flask backend is retired.
"""
import json
import os
import sys
import types
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "backend"))
os.chdir(ROOT / "backend")

# The PDF library and Postgres are irrelevant for rendering web templates.
sys.modules["weasyprint"] = types.SimpleNamespace(HTML=object, default_url_fetcher=lambda *a, **k: None)
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["FRONTEND_ORIGIN"] = "https://www.example.com"
import sqlite3
import sqlite3.dbapi2 as _d
_orig = sqlite3.connect
_f = lambda *a, **k: _orig(*a, **{kk: v for kk, v in k.items() if not kk.startswith("keepalives")})
sqlite3.connect = _f
_d.connect = _f

import app as flask_app  # noqa: E402


def to_ns(value):
    if isinstance(value, dict):
        return value
    return value


def make_gb(row):
    gb = SimpleNamespace(**{k: v for k, v in row.items() if k not in ("property", "host", "last_modified_time")})
    gb.property = SimpleNamespace(**row["property"]) if row.get("property") else None
    gb.host = SimpleNamespace(**row["host"]) if row.get("host") else None
    ts = row.get("last_modified_time")
    gb.last_modified_time = datetime.fromisoformat(ts) if ts else None
    return gb


(HERE / "golden").mkdir(exist_ok=True)
for path in sorted((HERE / "fixtures").glob("*.json")):
    row = json.loads(path.read_text(encoding="utf-8"))
    for watermark in (False, True):
        with flask_app.app.test_request_context("/"):
            resp = flask_app._render_guidebook(make_gb(row), show_watermark=watermark)
            html = resp.get_data(as_text=True)
        out = HERE / "golden" / f"{path.stem}__wm{int(watermark)}.html"
        out.write_text(html, encoding="utf-8")
        print(f"{out.name}: {len(html):,} bytes")
