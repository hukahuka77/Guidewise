from dotenv import load_dotenv
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML
from utils.aifunctions import get_ai_recommendations
# Import models from models.py to be used in PDF generation
from models import Guidebook, Host, Property, Wifi, Rule

load_dotenv()

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
        'host_name': guidebook.host.name,
        'property_name': guidebook.property.name,
        'wifi_network': guidebook.wifi.network if guidebook.wifi else 'N/A',
        'wifi_password': guidebook.wifi.password if guidebook.wifi else 'N/A',
        'check_in_time': guidebook.check_in_time,
        'check_out_time': guidebook.check_out_time,
        'address_street': guidebook.property.address_street,
        'address_city_state': guidebook.property.address_city_state,
        'address_zip': guidebook.property.address_zip,
        'access_info': guidebook.access_info,
        'rules': [rule.text for rule in guidebook.rules],
        'things_to_do': guidebook.things_to_do,
        'places_to_eat': guidebook.places_to_eat,
        'cover_image_url': guidebook.cover_image_url
    }

    # Setup Jinja2 environment
    env = Environment(loader=FileSystemLoader('.'))
    template = env.get_template("templates/guidebook_template.html")

    # Render the HTML template with data
    html_out = template.render(data)

    # Generate PDF from HTML
    pdf = HTML(string=html_out, base_url='.').write_pdf()
    return pdf


