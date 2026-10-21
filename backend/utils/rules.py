"""Helpers for normalizing house rules stored in legacy and current formats."""

import ast


def normalize_rules(raw_rules):
    """Normalize rules from various legacy formats into [{name, description}] for rendering.

    Supports:
    - Proper dicts: {"name": str, "description": str}
    - Nested dicts from older bug: {"name": {"name": str, "description": str}, "description": ""}
    - Strings like "No Smoking: Details" or "No Smoking"
    - Strings that look like python dicts: "{'name': 'No Smoking', 'description': '...'}"
    """
    rules_out = []
    if not raw_rules:
        return []
    for r in raw_rules:
        if not r:
            continue
        # Dict formats
        if isinstance(r, dict):
            name_val = r.get('name')
            desc_val = r.get('description')
            # Handle nested dict in name field
            if isinstance(name_val, dict) and ('name' in name_val or 'description' in name_val):
                inner = name_val
                name = str(inner.get('name') or '').strip()
                # Prefer inner description, fall back to outer description
                desc = str(inner.get('description') or desc_val or '').strip()
            else:
                name = str(name_val or '').strip()
                desc = str(desc_val or '').strip()
            if name or desc:
                rules_out.append({'name': name, 'description': desc})
            continue
        # String forms
        if isinstance(r, str):
            s = r.strip()
            # Try to parse legacy python-dict-style strings
            if s.startswith('{') and s.endswith('}'):
                try:
                    parsed = ast.literal_eval(s)
                    if isinstance(parsed, dict):
                        name = str(parsed.get('name') or '').strip()
                        desc = str(parsed.get('description') or '').strip()
                        if name or desc:
                            rules_out.append({'name': name, 'description': desc})
                            continue
                except Exception:
                    pass
            # Fallback: split on first colon
            if ':' in s:
                name_part, desc_part = s.split(':', 1)
                name = name_part.strip()
                desc = desc_part.strip()
                rules_out.append({'name': name or s, 'description': desc})
            else:
                rules_out.append({'name': s, 'description': ''})
    return rules_out


def rules_as_text(raw_rules):
    """Return rules as display strings ("Name: description") for the PDF templates."""
    lines = []
    for rule in normalize_rules(raw_rules):
        name, desc = rule['name'], rule['description']
        if name and desc:
            lines.append(f"{name}: {desc}")
        else:
            lines.append(name or desc)
    return lines
