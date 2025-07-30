import os
import json
from dotenv import load_dotenv
from openai import OpenAI
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

def get_ai_recommendations(address):
    """Get Things to Do and Places to Eat from OpenAI based on an address."""
    try:
        load_dotenv()
        openai_api_key = os.getenv("OPENAI_API_KEY")
        openai.Organization = os.getenv("OPENAI_ORG_ID")
        client = OpenAI(api_key=openai_api_key)
        prompt = f"""For the vacation rental located at {address}, please provide a list of local recommendations. I need a JSON object with two keys: 'things_to_do' and 'places_to_eat'. Each key should contain a list of exactly 3 items. Each item in the lists should be an object with 'name' and 'description' keys. Do not include image URLs."""

        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that provides local recommendations in a strict JSON format."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"}
        )

        recommendations = json.loads(response.choices[0].message.content)
        return recommendations
    except Exception as e:
        print(f"Could not get AI recommendations: {e}")
        return None

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
        "contact_phone": "(555) 987-6543"
    }

    # If recommendation lists are empty, fetch them from AI
    if not guidebook_data.get('things_to_do') or not guidebook_data.get('places_to_eat'):
        print("Fetching AI recommendations...")
        ai_recs = get_ai_recommendations(guidebook_data['location'])
        if ai_recs:
            guidebook_data['things_to_do'] = ai_recs.get('things_to_do', [])
            guidebook_data['places_to_eat'] = ai_recs.get('places_to_eat', [])

    template_file = "guidebook_template.html"
    output_file = "output/guidebook.pdf"

    print("Calling create_pdf...")
    success, message = create_pdf(guidebook_data, template_file, output_file)
    print("create_pdf returned.")
    print(message)
    print("Script finished.")
