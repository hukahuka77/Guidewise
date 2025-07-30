import os
from dotenv import load_dotenv
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML
from utils.aifunctions import get_ai_recommendations

def create_pdf(data, template_name, output_filename):
    """Render HTML template with data and convert to PDF using WeasyPrint."""
    try:
        env = Environment(loader=FileSystemLoader('templates'))
        template = env.get_template(template_name)
        html_content = template.render(data)
        output_dir = os.path.dirname(output_filename)
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
        HTML(string=html_content).write_pdf(output_filename)
        return True, f"Successfully created {output_filename}"
    except Exception as e:
        return False, f"An error occurred: {e}"

if __name__ == "__main__":
    load_dotenv()

    guidebook_data = {
        "property_name": "The Serene Getaway",
        "cover_image_url": "https://images.unsplash.com/photo-1568605114967-8130f3a36994?q=80&w=2070&auto=format&fit=crop",
        "welcome_message": "Welcome to your home away from home! We've prepared this guide to help you make the most of your stay. We hope you have a fantastic and relaxing time.",
        "location": "456 Tranquil Trail, Mountain View, CO 80401",
        "access_instructions": "Access is via a smart lock. Your unique code is 5678.",
        "check_in_time": "4:00 PM",
        "check_out_time": "10:00 AM",
        "house_rules": [
            "No smoking or vaping anywhere on the property.",
            "Please respect our neighbors and keep noise to a minimum after 10 PM.",
            "Kindly load and run the dishwasher before you depart.",
            "Ensure all windows and doors are locked when you leave."
        ],
        "things_to_do": [],
        "places_to_eat": [],
        "contact_name": "John Appleseed",
        "contact_phone": "(555) 987-6543",
        "num_things_to_do": 5,
        "num_places_to_eat": 5
    }

    # If recommendation lists are empty, fetch them from AI
    if not guidebook_data.get('things_to_do') or not guidebook_data.get('places_to_eat'):
        print("Fetching AI recommendations...")
        ai_recs = get_ai_recommendations(
            guidebook_data['location'], 
            guidebook_data.get('num_things_to_do', 3),
            guidebook_data.get('num_places_to_eat', 3)
        )
        if ai_recs:
            guidebook_data['things_to_do'] = ai_recs.get('things_to_do', [])
            guidebook_data['places_to_eat'] = ai_recs.get('places_to_eat', [])

    template_file = "guidebook_template.html"
    output_file = "output/guidebook.pdf"

    # Create the PDF
    success, message = create_pdf(guidebook_data, template_file, output_file)

    print(message)
