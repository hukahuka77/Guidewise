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


def publish_snapshot(gb):
    """What publish_guidebook stores: the marker plus the template rendered with ctx AND the legacy
    top-level variables. ctx.rules is normalised (the migration deliberately fixes that drift)."""
    template_key = gb.template_key or "template_original"
    if template_key not in flask_app.ALLOWED_TEMPLATE_KEYS:
        template_key = "template_original"
    template_file = flask_app.TEMPLATE_REGISTRY[template_key]
    base_tabs = ["welcome", "checkin", "property", "food", "activities", "rules", "checkout"]
    included = [t for t in (gb.included_tabs or base_tabs) if t in base_tabs or (isinstance(t, str) and t.startswith("custom_"))]
    meta = gb.custom_tabs_meta
    safe_meta = None
    if isinstance(meta, dict):
        safe_meta = {}
        for k, v in meta.items():
            if isinstance(v, dict):
                safe_meta[k] = {
                    "label": flask_app._strip_surrogates(str(v.get("label"))) if v.get("label") is not None else "",
                    "icon": flask_app._strip_surrogates(str(v.get("icon"))) if v.get("icon") is not None else "",
                }
    placeholder = "https://hojncqasasvvrhdmwwhv.supabase.co/storage/v1/object/public/my_images/home_placeholder.jpg"
    ctx = {
        "schema_version": 1, "id": gb.id,
        "property_name": getattr(gb.property, "name", None) or "My Guidebook",
        "host": {"name": getattr(gb.host, "name", None), "bio": getattr(gb.host, "bio", None),
                 "contact": getattr(gb.host, "contact", None), "photo_url": getattr(gb.host, "host_image_url", None)},
        "welcome_message": getattr(gb, "welcome_info", None),
        "safety_info": getattr(gb, "safety_info", {}) or {},
        "address": {"street": getattr(gb.property, "address_street", None),
                    "city_state": getattr(gb.property, "address_city_state", None),
                    "zip": getattr(gb.property, "address_zip", None)},
        "wifi_json": getattr(gb, "wifi_json", None) or {},
        "check_in_time": gb.check_in_time, "check_out_time": gb.check_out_time,
        "access_info": gb.access_info, "parking_info": gb.parking_info,
        "rules": flask_app.normalize_rules(getattr(gb, "rules_json", None) or []),
        "things_to_do": gb.things_to_do or [], "places_to_eat": gb.places_to_eat or [],
        "checkout_info": getattr(gb, "checkout_info", None) or [],
        "house_manual": getattr(gb, "house_manual", None) or [],
        "included_tabs": included,
        "custom_sections": getattr(gb, "custom_sections", None) or {},
        "custom_tabs_meta": safe_meta or (getattr(gb, "custom_tabs_meta", None) or {}),
        "cover_image_url": gb.cover_image_url or placeholder,
    }
    html = flask_app.PLACE_PHOTO_SNAPSHOT_MARKER + flask_app.render_template(
        template_file, ctx=ctx, id=gb.id,
        host_name=getattr(gb.host, "name", None), host_bio=getattr(gb.host, "bio", None),
        host_contact=getattr(gb.host, "contact", None), host_photo_url=getattr(gb.host, "host_image_url", None),
        property_name=gb.property.name, check_in_time=gb.check_in_time, check_out_time=gb.check_out_time,
        address_street=gb.property.address_street, address_city_state=gb.property.address_city_state,
        address_zip=gb.property.address_zip, access_info=gb.access_info,
        welcome_message=getattr(gb, "welcome_info", None), parking_info=getattr(gb, "parking_info", None),
        rules=getattr(gb, "rules_json", None) or [], things_to_do=gb.things_to_do, places_to_eat=gb.places_to_eat,
        checkout_info=getattr(gb, "checkout_info", None), house_manual=getattr(gb, "house_manual", None),
        included_tabs=included, custom_sections=getattr(gb, "custom_sections", None),
        custom_tabs_meta=safe_meta, cover_image_url=gb.cover_image_url,
    )
    return html


PUBLISH_FIXTURES = ("full_original", "full_welcomebook", "minimal_welcomebook", "legacy_rules_original")

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

for stem in PUBLISH_FIXTURES:
    row = json.loads((HERE / "fixtures" / f"{stem}.json").read_text(encoding="utf-8"))
    with flask_app.app.test_request_context("/"):
        html = publish_snapshot(make_gb(row))
    out = HERE / "golden" / f"{stem}__publish.html"
    out.write_text(html, encoding="utf-8")
    print(f"{out.name}: {len(html):,} bytes")
