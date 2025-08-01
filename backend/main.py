from dotenv import load_dotenv
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML
from utils.aifunctions import get_ai_recommendations

load_dotenv()

def create_guidebook_pdf(data):
    """
    Generates a PDF guidebook from a dictionary of data.
    
    Args:
        data (dict): A dictionary containing all the necessary information for the guidebook.

    Returns:
        bytes: The generated PDF file as a byte string.
    """


    # Setup Jinja2 environment
    env = Environment(loader=FileSystemLoader('.'))
    template = env.get_template("templates/guidebook_template.html")

    # Render the HTML template with data
    html_out = template.render(data)

    # Generate PDF from HTML
    pdf = HTML(string=html_out, base_url='.').write_pdf()
    return pdf

# This block allows for local testing of the PDF generation without running the Flask app
if __name__ == '__main__':
    # Sample data for local testing
    sample_data = {
        'property_name': 'The Sunny Side',
        'host_name': 'John Doe',
        'wifi_network': 'SuperFastWiFi',
        'wifi_password': 'guest123!',
        'check_in_time': '3:00 PM',
        'check_out_time': '11:00 AM',
        'address': '1 Lombard Street, London, UK',
        'address_street': '1 Lombard Street',
        'address_city_state': 'London',
        'address_zip': 'EC3V 9AA',
        'access_info': 'The front door code is 1234. Please make sure to lock the door when you leave.',
        'rules': [
            'No smoking',
            'No pets',
            'No parties or events',
            'Please respect the quiet hours after 10 PM'
        ],
        'num_things_to_do': 3,
        'num_places_to_eat': 3,
        'cover_image_url': 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    }

    # Generate the PDF
    print("Generating sample PDF...")
    pdf_bytes = create_guidebook_pdf(sample_data)

    # Save the generated PDF to a file
    output_filename = "guidebook_local_test.pdf"
    with open(output_filename, "wb") as f:
        f.write(pdf_bytes)
    
    print(f"PDF '{output_filename}' has been generated.")
