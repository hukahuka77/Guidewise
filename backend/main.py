from dotenv import load_dotenv
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML
from utils.aifunctions import get_ai_recommendations
# Import models from models.py to be used in PDF generation
from models import Guidebook, Host, Property, Wifi, Rule
import json
import ast
import urllib.parse

load_dotenv()

# Map template keys to HTML template files for PDF rendering (PDF-only)
# Canonical PDF keys
PDF_TEMPLATE_REGISTRY = {
    "template_pdf_original": "templates/templates_pdf/template_pdf_original.html",
    "template_pdf_basic": "templates/templates_pdf/template_pdf_basic.html",
    "template_pdf_mobile": "templates/templates_pdf/template_pdf_mobile.html",
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


def create_guidebook_pdf(guidebook, qr_url: str | None = None):
    """
    Generates a PDF guidebook from a Guidebook database object.
    
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
        'wifi_network': guidebook.wifi.network if getattr(guidebook, 'wifi', None) else 'N/A',
        'wifi_password': guidebook.wifi.password if getattr(guidebook, 'wifi', None) else 'N/A',
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
        'wifi': {
            'network': data['wifi_network'] if data['wifi_network'] != 'N/A' else None,
            'password': data['wifi_password'] if data['wifi_password'] != 'N/A' else None,
        },
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


