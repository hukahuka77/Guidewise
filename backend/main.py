from dotenv import load_dotenv
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML, default_url_fetcher
from utils.aifunctions import get_ai_recommendations
# Import models from models.py to be used in PDF generation
from models import Guidebook, Host, Property
import json
import ast
import urllib.parse
import ssl
import urllib.request

load_dotenv()

# Custom URL fetcher that ignores SSL verification for external images
def custom_url_fetcher(url):
    """Fetch URLs with relaxed SSL verification to allow external images."""
    try:
        # Create a context that doesn't verify SSL certificates
        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE

        # Add a user agent to avoid being blocked
        req = urllib.request.Request(
            url,
            headers={'User-Agent': 'Mozilla/5.0 (compatible; GuidewisePDF/1.0)'}
        )

        with urllib.request.urlopen(req, context=context, timeout=10) as response:
            return {
                'string': response.read(),
                'mime_type': response.headers.get('Content-Type', 'application/octet-stream'),
                'encoding': response.headers.get_content_charset(),
                'redirected_url': response.url,
            }
    except Exception as e:
        print(f"Failed to fetch {url}: {e}")
        # Fall back to default fetcher
        return default_url_fetcher(url)

# Map template keys to HTML template files for PDF rendering (PDF-only)
# Canonical PDF keys
PDF_TEMPLATE_REGISTRY = {
    "template_pdf_original": "templates/templates_pdf/template_pdf_original.html",
    "template_pdf_basic": "templates/templates_pdf/template_pdf_basic.html",
    "template_pdf_mobile": "templates/templates_pdf/template_pdf_mobile.html",
    # New: QR-focused poster template
    "template_pdf_qr": "templates/templates_pdf/template_pdf_qr.html",
}

# No legacy mapping: expect canonical PDF keys only. Fallback to template_pdf_original.

def _normalize_recommendations(items):
    """Normalize list items that may be dicts or stringified dicts.
    Returns list of dicts with at least name/title and description/address if present.
    """
    normalized = []
    if not items:
        return normalized
    for it in items:
        obj = None
        if isinstance(it, dict):
            obj = it
        elif isinstance(it, str):
            s = it.strip()
            # Try JSON first
            try:
                obj = json.loads(s)
            except Exception:
                # Try Python literal (handles single quotes)
                try:
                    val = ast.literal_eval(s)
                    if isinstance(val, dict):
                        obj = val
                except Exception:
                    obj = None
        if obj is None:
            # Fallback to simple text item
            obj = {"name": str(it)}
        # Ensure keys exist
        normalized.append({
            "name": obj.get("name") or obj.get("title") or str(obj),
            "description": obj.get("description") or "",
            "address": obj.get("address") or "",
            "image_url": obj.get("image_url") or obj.get("photo") or "",
        })
    return normalized


def create_print_pdf_from_web_template(guidebook):
    """
    Generates a print-ready PDF using dedicated print templates.
    Uses professionally designed PDF templates optimized for physical printing.

    Args:
        guidebook (Guidebook): The Guidebook object from the database.

    Returns:
        bytes: The generated PDF file as a byte string.
    """
    # Map template keys to their print-optimized PDF templates
    PRINT_TEMPLATE_REGISTRY = {
        "template_welcomebook": "templates/templates_pdf/template_pdf_welcomebook.html",
        "template_modern": "templates/templates_pdf/template_pdf_original.html",
        "template_generic": "templates/templates_pdf/template_pdf_basic.html",
        "template_original": "templates/templates_pdf/template_pdf_original.html",
    }

    # Get the template key from the guidebook (defaults to welcomebook for print)
    template_key = getattr(guidebook, 'template_key', None) or 'template_welcomebook'
    if template_key not in PRINT_TEMPLATE_REGISTRY:
        template_key = 'template_welcomebook'

    template_file = PRINT_TEMPLATE_REGISTRY[template_key]

    # Build the context (same as web rendering)
    PLACEHOLDER_COVER_URL = (
        "https://hojncqasasvvrhdmwwhv.supabase.co/storage/v1/object/public/my_images/home_placeholder.jpg"
    )

    base_tabs = ['welcome','checkin','property','food','activities','rules','checkout']
    included_tabs = getattr(guidebook, 'included_tabs', None) or base_tabs
    included_tabs = [t for t in included_tabs if (t in base_tabs) or (isinstance(t, str) and t.startswith('custom_'))]

    # Sanitize custom tabs meta
    safe_custom_tabs_meta = None
    try:
        meta = getattr(guidebook, 'custom_tabs_meta', None)
        if isinstance(meta, dict):
            safe_custom_tabs_meta = {}
            for k, v in meta.items():
                if isinstance(v, dict):
                    lbl = str(v.get('label')) if v.get('label') is not None else ''
                    ico = str(v.get('icon')) if v.get('icon') is not None else ''
                    safe_custom_tabs_meta[k] = {'label': lbl, 'icon': ico}
    except Exception:
        safe_custom_tabs_meta = getattr(guidebook, 'custom_tabs_meta', None)

    ctx = {
        "schema_version": 1,
        "id": guidebook.id,
        "property_name": (getattr(guidebook.property, 'name', None) or 'My Guidebook') if hasattr(guidebook, 'property') else 'My Guidebook',
        "host": {
            "name": getattr(guidebook.host, 'name', None) if hasattr(guidebook, 'host') and guidebook.host else None,
            "bio": getattr(guidebook.host, 'bio', None) if hasattr(guidebook, 'host') and guidebook.host else None,
            "contact": getattr(guidebook.host, 'contact', None) if hasattr(guidebook, 'host') and guidebook.host else None,
            "photo_url": getattr(guidebook.host, 'host_image_url', None) if hasattr(guidebook, 'host') and guidebook.host else None,
        },
        "welcome_message": getattr(guidebook, 'welcome_info', None),
        "safety_info": getattr(guidebook, 'safety_info', {}) or {},
        "address": {
            "street": getattr(guidebook.property, 'address_street', None) if hasattr(guidebook, 'property') and guidebook.property else None,
            "city_state": getattr(guidebook.property, 'address_city_state', None) if hasattr(guidebook, 'property') and guidebook.property else None,
            "zip": getattr(guidebook.property, 'address_zip', None) if hasattr(guidebook, 'property') and guidebook.property else None,
        },
        "wifi_json": getattr(guidebook, 'wifi_json', None) or {},
        "check_in_time": getattr(guidebook, 'check_in_time', None),
        "check_out_time": getattr(guidebook, 'check_out_time', None),
        "access_info": getattr(guidebook, 'access_info', None),
        "parking_info": getattr(guidebook, 'parking_info', None),
        "rules": getattr(guidebook, 'rules_json', None) or [],
        "things_to_do": getattr(guidebook, 'things_to_do', None) or [],
        "places_to_eat": getattr(guidebook, 'places_to_eat', None) or [],
        "checkout_info": getattr(guidebook, 'checkout_info', None) or [],
        "house_manual": getattr(guidebook, 'house_manual', None) or [],
        "included_tabs": included_tabs,
        "custom_sections": getattr(guidebook, 'custom_sections', None) or {},
        "custom_tabs_meta": safe_custom_tabs_meta or (getattr(guidebook, 'custom_tabs_meta', None) or {}),
        "cover_image_url": (getattr(guidebook, 'cover_image_url', None) or PLACEHOLDER_COVER_URL),
    }

    # Setup Jinja2 environment
    env = Environment(loader=FileSystemLoader(['.', 'templates']))
    template = env.get_template(template_file)

    # Render the HTML template with context
    # Don't show watermark in printed version
    html_out = template.render(ctx=ctx, show_watermark=False)

    # Generate PDF from HTML using WeasyPrint with custom URL fetcher
    # This allows fetching external images with relaxed SSL verification
    pdf = HTML(string=html_out, base_url='.', url_fetcher=custom_url_fetcher).write_pdf()
    return pdf


def create_guidebook_pdf(guidebook, qr_url: str | None = None):
    """
    Generates a PDF guidebook from a Guidebook database object using PDF-specific templates.

    Args:
        guidebook (Guidebook): The Guidebook object from the database.

    Returns:
        bytes: The generated PDF file as a byte string.
    """
    # Construct the data dictionary for the template from the guidebook object
    # Precompute QR image source if provided (embed external QR service URL)
    qr_img_src = None
    if qr_url:
        try:
            qr_img_src = (
                "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data="
                + urllib.parse.quote(qr_url, safe="")
            )
        except Exception:
            qr_img_src = None

    data = {
        'id': guidebook.id,
        'host_name': guidebook.host.name if getattr(guidebook, 'host', None) else 'N/A',
        'property_name': guidebook.property.name if getattr(guidebook, 'property', None) else 'N/A',
        'wifi_json': getattr(guidebook, 'wifi_json', None) or {},
        'check_in_time': guidebook.check_in_time,
        'check_out_time': guidebook.check_out_time,
        'address_street': guidebook.property.address_street if getattr(guidebook, 'property', None) else '',
        'address_city_state': guidebook.property.address_city_state if getattr(guidebook, 'property', None) else '',
        'address_zip': guidebook.property.address_zip if getattr(guidebook, 'property', None) else '',
        'access_info': guidebook.access_info,
        'rules': [rule.text for rule in getattr(guidebook, 'rules', [])],
        'things_to_do': _normalize_recommendations(getattr(guidebook, 'things_to_do', []) or []),
        'places_to_eat': _normalize_recommendations(getattr(guidebook, 'places_to_eat', []) or []),
        'cover_image_url': getattr(guidebook, 'cover_image_url', None),
        'welcome_message': getattr(guidebook, 'welcome_info', None),
        'included_tabs': getattr(guidebook, 'included_tabs', []) or [],
        'custom_sections': getattr(guidebook, 'custom_sections', {}) or {},
        'custom_tabs_meta': getattr(guidebook, 'custom_tabs_meta', {}) or {},
        # Optional QR image URL to include in the PDF templates
        'qr_img_src': qr_img_src,
    }

    # Build unified context (ctx) similar to URL renderer
    base_tabs = ['welcome','checkin','property','food','activities','rules','checkout']
    included_tabs = [t for t in (data['included_tabs'] or base_tabs) if (t in base_tabs) or (isinstance(t, str) and t.startswith('custom_'))]
    ctx = {
        'schema_version': 1,
        'id': data['id'],
        'property_name': data['property_name'] if data['property_name'] != 'N/A' else None,
        'host': {
            'name': data['host_name'] if data['host_name'] != 'N/A' else None,
            'bio': getattr(guidebook.host, 'bio', None) if getattr(guidebook, 'host', None) else None,
            'contact': getattr(guidebook.host, 'contact', None) if getattr(guidebook, 'host', None) else None,
            'photo_url': getattr(guidebook.host, 'host_image_url', None) if getattr(guidebook, 'host', None) else None,
        },
        'welcome_message': data['welcome_message'],
        'safety_info': getattr(guidebook, 'safety_info', {}) or {},
        'address': {
            'street': data['address_street'],
            'city_state': data['address_city_state'],
            'zip': data['address_zip'],
        },
        'wifi_json': data['wifi_json'],
        'check_in_time': data['check_in_time'],
        'check_out_time': data['check_out_time'],
        'access_info': data['access_info'],
        'parking_info': getattr(guidebook, 'parking_info', None),
        'rules': data['rules'],
        'things_to_do': data['things_to_do'],
        'places_to_eat': data['places_to_eat'],
        'checkout_info': getattr(guidebook, 'checkout_info', None) or [],
        'included_tabs': included_tabs,
        'custom_sections': data['custom_sections'],
        'custom_tabs_meta': data['custom_tabs_meta'],
        'cover_image_url': data['cover_image_url'],
        'qr_img_src': data['qr_img_src'],
    }

    # Setup Jinja2 environment
    # Search for templates at project root and inside templates/
    env = Environment(loader=FileSystemLoader(['.', 'templates']))
    # Expect canonical PDF keys (template_pdf_original, template_pdf_basic). Fallback to original.
    raw_key = getattr(guidebook, 'template_key', None)
    selected_key = raw_key if raw_key in PDF_TEMPLATE_REGISTRY else 'template_pdf_original'
    template_path = PDF_TEMPLATE_REGISTRY.get(selected_key, PDF_TEMPLATE_REGISTRY['template_pdf_original'])
    template = env.get_template(template_path)

    # Render the HTML template with data
    html_out = template.render(data, ctx=ctx)

    # Generate PDF from HTML
    pdf = HTML(string=html_out, base_url='.').write_pdf()
    return pdf


