#!/usr/bin/env python3
"""Record what the Python helpers return for a set of tricky inputs (reference for the TS ports).

Run from the repository root with the backend dependencies installed:
    python3 frontend/tests/parity/generate_unit_expectations.py
Remove this harness once the Flask backend is retired.
"""
import json
import sys
from pathlib import Path

from jinja2 import Environment

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "backend"))
from utils.place_photos import google_photo_reference, place_photo_url  # noqa: E402
from utils.rules import normalize_rules, rules_as_text  # noqa: E402

env = Environment()

photo_items = [
    {"name": "A", "image_url": "CmRaAAAAref", "place_id": "ChIJ1"},
    {"name": "A", "image_url": "CmRaAAAAref"},
    {"name": "A", "place_id": "ChIJ1"},
    {"name": "A"},
    {"image_url": "https://example.com/x.jpg", "place_id": "p"},
    {"image_url": "data:image/png;base64,AAAA"},
    {"image_url": "https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=REF%2Fabc+d&key=K", "name": "N", "address": "1 St"},
    {"image_url": "https://maps.googleapis.com/maps/api/place/photo?photo_reference=&key=K", "place_id": "p"},
    {"image_url": "https://maps.googleapis.com:443/maps/api/place/photo?photo_reference=R", "place_id": "p"},
    {"image_url": "https://evil.com/maps/api/place/photo?photo_reference=R"},
    {"image_url": "  spaced ref  ", "place_id": " pid ", "name": " Name ", "address": " Addr "},
    {"image_url": "ref!'()*~ &=/+", "name": "Taco (best!) & more", "address": "55 Elm St, Austin"},
    {"image_url": "r", "name": "x" * 400},
    {"image_url": "r", "name": "Café Ñoño \U0001F600"},
    {"image_url": 12345},
    {"image_url": None, "place_id": None},
    "not a dict",
    None,
    [],
]
urlencode_inputs = ["12 Main St, Austin, TX", "a/b/c", "Tom & Jerry's (best!) *~_.-", "café \U0001F600", "50% off + more", "", "x y\tz\nw"]
title_inputs = ["custom_my_tab", "my tab", "custom pets & dogs", "don't stop", "ALL CAPS", "a-b c(d)e[f]g<h", "  lead", "mIxEd CaSe", ""]
photo_refs = [i["image_url"] for i in photo_items if isinstance(i, dict) and isinstance(i.get("image_url"), str)]
rules_cases = [
    [{"name": "No smoking", "description": "Anywhere"}, {"name": "Quiet", "description": ""}],
    ["No parties: Max 6", "{'name': 'Recycle', 'description': 'Blue bin'}", "plain", "", None],
    [{"name": {"name": "Pets", "description": "Ask"}, "description": ""}, {"name": {"description": "only inner desc"}, "description": "outer"}],
    ["{'name': 'A', 'description': 'it\\'s \"quoted\"', 'extra': [1, 2.5, None, True]}", "{not valid python}", "{'a': 1}", "Key: val: more"],
    [{"name": "", "description": ""}, {}, [], 0, "  spaced : out  "],
    [{"name": 5, "description": 7}],
    # Intentionally not compared: Python iterates a bare string character by character; the TS port
    # returns [] for non-list input (rules_json is always a JSON list in real data).
    None,
    {},
]

out = {
    "place_photo_url": [{"input": i, "expected": place_photo_url(i)} for i in photo_items],
    "google_photo_reference": [{"input": r, "expected": google_photo_reference(r)} for r in photo_refs],
    "urlencode": [{"input": s, "expected": env.from_string("{{ v | urlencode }}").render(v=s)} for s in urlencode_inputs],
    "title": [{"input": s, "expected": env.from_string("{{ v | title }}").render(v=s)} for s in title_inputs],
    "normalize_rules": [{"input": c, "expected": normalize_rules(c)} for c in rules_cases],
    "rules_as_text": [{"input": c, "expected": rules_as_text(c)} for c in rules_cases],
}
path = Path(__file__).resolve().parent / "unit_expectations.json"
path.write_text(json.dumps(out, indent=1, ensure_ascii=True) + "\n", encoding="utf-8")
print({k: len(v) for k, v in out.items()}, "->", path.name)
