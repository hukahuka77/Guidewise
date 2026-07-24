#!/usr/bin/env python3
"""Verify that the Guidewise Flask application imports and initializes."""

from __future__ import annotations

import importlib
import os
import sys
from unittest.mock import patch

from flask import Flask


def main() -> int:
    # Keep the import isolated from any configured production database.
    os.environ["DATABASE_URL"] = (
        "postgresql://guidewise_smoke:guidewise_smoke@127.0.0.1:1/guidewise_smoke"
    )

    try:
        # app.py creates tables at import time. The smoke check needs to verify
        # initialization without connecting to a real database.
        with patch("flask_sqlalchemy.SQLAlchemy.create_all"):
            app_module = importlib.import_module("app")
    except Exception as exc:
        print(
            f"Backend smoke check failed while importing app: "
            f"{type(exc).__name__}: {exc}",
            file=sys.stderr,
        )
        raise

    flask_app = getattr(app_module, "app", None)
    if not isinstance(flask_app, Flask):
        print(
            "Backend smoke check failed: app.app is not a Flask application.",
            file=sys.stderr,
        )
        return 1

    if "sqlalchemy" not in flask_app.extensions:
        print(
            "Backend smoke check failed: SQLAlchemy was not initialized.",
            file=sys.stderr,
        )
        return 1

    route_count = len(list(flask_app.url_map.iter_rules()))
    if route_count <= 1:
        print(
            "Backend smoke check failed: no application routes were registered.",
            file=sys.stderr,
        )
        return 1

    print(f"Backend smoke check passed: Flask initialized with {route_count} routes.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
