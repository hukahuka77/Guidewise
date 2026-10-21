#!/usr/bin/env python3
"""Render every fixture through the REAL Flask PDF code path (backend/main.py) and save the HTML that
WeasyPrint would have been given. The Next.js renderer must produce the same HTML (pdf.parity.test.ts).

Run from the repository root with the backend dependencies and WeasyPrint installed:
    python3 frontend/tests/parity/generate_pdf_goldens.py
Google lookups are replaced by the deterministic stubs below (the TS test uses the same rules).
Remove this harness once the Flask backend is retired.
"""
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "backend"))
os.chdir(ROOT / "backend")

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["FRONTEND_ORIGIN"] = "https://www.example.com"
os.environ["GOOGLE_API_KEY"] = "testkey"
import sqlite3
import sqlite3.dbapi2 as _d
_orig = sqlite3.connect
_f = lambda *a, **k: _orig(*a, **{kk: v for kk, v in k.items() if not kk.startswith("keepalives")})
sqlite3.connect = _f
_d.connect = _f

import app as flask_app  # noqa: E402,F401
import main as pdf_main  # noqa: E402
from datetime import datetime  # noqa: E402
from types import SimpleNamespace  # noqa: E402


def make_gb(row):
    gb = SimpleNamespace(**{k: v for k, v in row.items() if k not in ("property", "host", "last_modified_time")})
    gb.property = SimpleNamespace(**row["property"]) if row.get("property") else None
    gb.host = SimpleNamespace(**row["host"]) if row.get("host") else None
    ts = row.get("last_modified_time")
    gb.last_modified_time = datetime.fromisoformat(ts) if ts else None
    return gb


# Deterministic Google stubs, mirrored in tests/parity/pdf.parity.test.ts
def stub_reference(place_id):
    if place_id == "ChIJfail":
        raise RuntimeError("lookup failed")
    if place_id.startswith("ChIJnone"):
        return None
    return "REF_" + place_id

def stub_search(query, location=None):
    if "NoMatch" in query:
        return {"results": []}
    return {"results": [{"place_id": "FOUND"}]}

pdf_main.google_places_photo_reference = stub_reference
pdf_main.google_places_text_search = stub_search

captured = {}
class FakeHTML:
    def __init__(self, string=None, **_):
        captured["html"] = string
    def write_pdf(self):
        return b"%PDF-stub"
pdf_main.HTML = FakeHTML

PDF_KEYS = ["template_pdf_original", "template_pdf_basic", "template_pdf_mobile", "template_pdf_qr", "template_pdf_modern"]
QR_URL = "https://www.example.com/g/my-place?x=1&y=(2)"

out_dir = HERE / "golden_pdf"
out_dir.mkdir(exist_ok=True)
for stale in out_dir.glob("*.html"):
    stale.unlink()


def write(name):
    """Fixtures with unpaired surrogates would make WeasyPrint itself fail to encode; skip those."""
    try:
        data = captured["html"].encode("utf-8")
        (out_dir / name).write_bytes(data)
        return True
    except UnicodeEncodeError:
        print("skipped (unencodable):", name)
        return False

inputs_dir = out_dir / "_inputs"
inputs_dir.mkdir(exist_ok=True)


def sanitize(row):
    """A dict where text is expected in a custom section makes Jinja print its Python repr, which the
    port intentionally does not reproduce; the PDF parity inputs use plain strings there."""
    sections = row.get("custom_sections")
    if isinstance(sections, dict):
        row["custom_sections"] = {
            k: [b if isinstance(b, str) else f"{b.get('name', '')}: {b.get('description', '')}" for b in blocks]
            if isinstance(blocks, list) else blocks
            for k, blocks in sections.items()
        }
    return row


for path in sorted((HERE / "fixtures").glob("*.json")):
    row = sanitize(json.loads(path.read_text(encoding="utf-8")))
    (inputs_dir / path.name).write_text(json.dumps(row, ensure_ascii=True, indent=1), encoding="utf-8")
    for key in PDF_KEYS:
        for qr in (None, QR_URL):
            if qr and path.stem not in ("full_original", "pdf_edge_cases"):
                continue
            gb = make_gb(row)
            gb.template_key = key
            pdf_main.create_guidebook_pdf(gb, qr_url=qr)
            name = f"{path.stem}__{key}{'__qr' if qr else ''}.html"
            if not write(name):
                continue
    gb = make_gb(row)
    pdf_main.create_print_pdf_from_web_template(gb)
    write(f"{path.stem}__print.html")
print(len(list(out_dir.glob("*.html"))), "goldens written")
