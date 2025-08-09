from dotenv import load_dotenv
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML
from utils.aifunctions import get_ai_recommendations
# Import models from models.py to be used in PDF generation
from models import Guidebook, Host, Property, Wifi, Rule
import json
import ast

load_dotenv()

# Map template keys to HTML template files for PDF rendering (PDF-only)
# For now, both keys use the same PDF template until additional variants are added.
TEMPLATE_REGISTRY = {
    "template_1": "templates/templates_pdf/template_pdf1.html",
    "template_2": "templates/templates_pdf/template_pdf2_basic.html",
}

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


def create_guidebook_pdf(guidebook):
    """
    Generates a PDF guidebook from a Guidebook database object.
    
    Args:
        guidebook (Guidebook): The Guidebook object from the database.

    Returns:
        bytes: The generated PDF file as a byte string.
    """
    # Construct the data dictionary for the template from the guidebook object
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
        'welcome_message': getattr(guidebook, 'welcome_message', None),
        'included_tabs': getattr(guidebook, 'included_tabs', []) or [],
        'custom_sections': getattr(guidebook, 'custom_sections', {}) or {},
        'custom_tabs_meta': getattr(guidebook, 'custom_tabs_meta', {}) or {},
    }

    # Setup Jinja2 environment
    env = Environment(loader=FileSystemLoader('.'))
    selected_key = getattr(guidebook, 'template_key', None) or 'template_1'
    template_path = TEMPLATE_REGISTRY.get(selected_key, TEMPLATE_REGISTRY['template_1'])
    template = env.get_template(template_path)

    # Render the HTML template with data
    html_out = template.render(data)

    # Generate PDF from HTML
    pdf = HTML(string=html_out, base_url='.').write_pdf()
    return pdf


