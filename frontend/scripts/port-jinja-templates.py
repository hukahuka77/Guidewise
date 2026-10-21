#!/usr/bin/env python3
"""Copy the Flask guidebook templates into the Next.js app (Nunjucks).

Nunjucks is Jinja-compatible; only a few Python-isms need rewriting:
  X.startswith(..)            -> X.startsWith(..)
  ctx.custom_*.get(key)       -> ctx.custom_*[key]
  for k, v in d.items()       -> for k, v in d
  `else None`                 -> `else null`
Run from the repository root. Only the templates registered in TEMPLATE_REGISTRY are ported.
"""
import re
import shutil
from pathlib import Path

SRC = Path("backend/templates")
DST = Path("frontend/src/templates/guidebook")
FILES = [
    "base_guidebook.html",
    "_macros.html",
    "templates_url/template_original.html",
    "templates_url/template_generic.html",
    "templates_url/template_welcomebook.html",
]

RULES = [
    (re.compile(r"\.startswith\("), ".startsWith("),
    (re.compile(r"(ctx\.custom_(?:tabs_meta|sections))\.get\(([^()]+)\)"), r"\1[\2]"),
    (re.compile(r"(\{%\s*for\s+\w+\s*,\s*\w+\s+in\s+ctx\.custom_sections)\.items\(\)"), r"\1"),
    (re.compile(r"\belse None\b"), "else null"),
]

for rel in FILES:
    text = (SRC / rel).read_text(encoding="utf-8")
    for pattern, repl in RULES:
        text = pattern.sub(repl, text)
    out = DST / rel
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text, encoding="utf-8")
    print("ported", rel)
