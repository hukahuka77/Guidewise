#!/usr/bin/env python3
"""Copy the Flask guidebook templates into the Next.js app (Nunjucks).

Nunjucks is Jinja-compatible; only a few Python-isms need rewriting:
  X.startswith(..)            -> X.startsWith(..)
  ctx.custom_*.get(key)       -> ctx.custom_*[key]
  for k, v in d.items()       -> for k, v in d
  `else None`                 -> `else null`
Run from the repository root. Only the templates registered in TEMPLATE_REGISTRY are ported, plus
the PDF templates reachable from backend/main.py (the unreachable `template_pdf_modern` is skipped).
"""
import re
import shutil
from pathlib import Path

SRC = Path("backend/templates")
DST = Path("frontend/src/templates/guidebook")
PDF_DST = Path("frontend/src/templates/pdf")
FILES = [
    "base_guidebook.html",
    "_macros.html",
    "templates_url/template_original.html",
    "templates_url/template_generic.html",
    "templates_url/template_welcomebook.html",
]

PDF_FILES = [
    "base_pdf.html",
    "_pdf_macros.html",
    "templates_pdf/template_pdf_original.html",
    "templates_pdf/template_pdf_basic.html",
    "templates_pdf/template_pdf_mobile.html",
    "templates_pdf/template_pdf_qr.html",
    "templates_pdf/template_pdf_welcomebook.html",
]

RULES = [
    (re.compile(r"\.startswith\("), ".startsWith("),
    (re.compile(r"(ctx\.custom_(?:tabs_meta|sections))\.get\(([^()]+)\)"), r"\1[\2]"),
    (re.compile(r"(\{%\s*for\s+\w+\s*,\s*\w+\s+in\s+ctx\.custom_sections)\.items\(\)"), r"\1"),
    (re.compile(r"\belse None\b"), "else null"),
]

# PDF templates additionally use dict.get(key), Python `None` and macro defaults of None.
PDF_RULES = RULES + [
    (re.compile(r"\.get\(([^()]+)\)"), r"[\1]"),
    (re.compile(r"\bNone\b"), "null"),
]

for files, dst, rules in ((FILES, DST, RULES), (PDF_FILES, PDF_DST, PDF_RULES)):
    for rel in files:
        text = (SRC / rel).read_text(encoding="utf-8")
        for pattern, repl in rules:
            text = pattern.sub(repl, text)
        out = dst / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(text, encoding="utf-8")
        print("ported", rel)
