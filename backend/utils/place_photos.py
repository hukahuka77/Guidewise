"""Helpers for rendering durable place-photo URLs."""

from urllib.parse import parse_qs, urlencode, urlparse


def google_photo_reference(image_url: str) -> str:
    """Extract a reference from a Google photo URL, or return a raw reference."""
    value = (image_url or "").strip()
    if not value:
        return ""
    if value.startswith(("http://", "https://")):
        parsed = urlparse(value)
        if parsed.netloc.endswith("googleapis.com") and "/place/photo" in parsed.path:
            return (parse_qs(parsed.query).get("photo_reference") or [""])[0]
        return ""
    return value


def place_photo_url(item: dict, maxwidth: int = 800) -> str:
    """Return a hosted image unchanged or build the Guidewise photo proxy URL.

    Google photo references are temporary. New recommendation records also carry
    a durable place_id, which lets the proxy obtain Google's current reference.
    The query value allows the proxy to repair legacy records after an old
    reference expires.
    """
    if not isinstance(item, dict):
        return ""

    image_url = str(item.get("image_url") or "").strip()
    place_id = str(item.get("place_id") or "").strip()

    if image_url.startswith(("http://", "https://", "data:")):
        google_reference = google_photo_reference(image_url)
        if not google_reference:
            return image_url
    else:
        google_reference = image_url

    if not place_id and not google_reference:
        return ""

    params = {"maxwidth": max(1, min(int(maxwidth), 1600))}
    if place_id:
        params["place_id"] = place_id
    if google_reference:
        params["photo_reference"] = google_reference

    name = str(item.get("name") or "").strip()
    address = str(item.get("address") or "").strip()
    query = ", ".join(part for part in (name, address) if part)
    if query:
        params["query"] = query[:300]

    return f"/api/place-photo?{urlencode(params)}"
