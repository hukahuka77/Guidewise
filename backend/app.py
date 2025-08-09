from flask import Flask, request, send_file, render_template, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text
import main as pdf_generator
import io
from dotenv import load_dotenv
import os

# Import db and models from models.py
from models import db, Guidebook, Host, Property, Wifi, Rule
from utils.ai_food import get_ai_food_recommendations
from utils.ai_activities import get_ai_activity_recommendations

load_dotenv() # Load environment variables from .env file

app = Flask(__name__)
CORS(app)

# Configure the database using the DATABASE_URL from .env, with a fallback to SQLite
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize the database with the app
db.init_app(app)

# Template registry mapping keys to template files
TEMPLATE_REGISTRY = {
    "template_1": "templates_url/template_1.html",
    "template_2": "templates_url/template_2.html",
}
ALLOWED_TEMPLATE_KEYS = set(TEMPLATE_REGISTRY.keys())

@app.route('/guidebook/<guidebook_id>')
def view_guidebook(guidebook_id):
    guidebook = Guidebook.query.get_or_404(guidebook_id)
    # Handle case where wifi might be null (pass through None/empty; template handles conditionals)
    wifi_network = guidebook.wifi.network if guidebook.wifi and guidebook.wifi.network else None
    wifi_password = guidebook.wifi.password if guidebook.wifi and guidebook.wifi.password else None

    template_key = getattr(guidebook, 'template_key', None) or 'template_1'
    template_file = TEMPLATE_REGISTRY.get(template_key, TEMPLATE_REGISTRY['template_1'])
    return render_template(template_file, 
        id=guidebook.id, 
        host_name=guidebook.host.name, 
        host_bio=getattr(guidebook.host, 'bio', None),
        host_photo_url=getattr(guidebook.host, 'host_image_base64', None),
        property_name=guidebook.property.name, 
        wifi_network=wifi_network, 
        wifi_password=wifi_password, 
        check_in_time=guidebook.check_in_time, 
        check_out_time=guidebook.check_out_time, 
        address_street=guidebook.property.address_street, 
        address_city_state=guidebook.property.address_city_state, 
        address_zip=guidebook.property.address_zip, 
        access_info=guidebook.access_info, 
        welcome_message=getattr(guidebook, 'welcome_info', None),
        parking_info=getattr(guidebook, 'parking_info', None),
        rules=[rule.text for rule in guidebook.rules], 
        things_to_do=guidebook.things_to_do, 
        places_to_eat=guidebook.places_to_eat, 
        checkout_info=getattr(guidebook, 'checkout_info', None),
        cover_image_url=guidebook.cover_image_url
    )

@app.route('/api/generate', methods=['POST'])
def generate_guidebook_route():
    data = request.json

    # Get AI recommendations only if not provided by client
    has_things = isinstance(data.get('things_to_do'), list) and len(data.get('things_to_do')) > 0
    has_places = isinstance(data.get('places_to_eat'), list) and len(data.get('places_to_eat')) > 0
    if not (has_things and has_places):
        full_address = f"{data.get('address_street', '')}, {data.get('address_city_state', '')}, {data.get('address_zip', '')}"
        try:
            from utils.aifunctions import get_ai_recommendations
            recommendations = get_ai_recommendations(full_address)
            data['things_to_do'] = data.get('things_to_do') or recommendations.get('things_to_do', [])
            data['places_to_eat'] = data.get('places_to_eat') or recommendations.get('places_to_eat', [])
        except Exception as e:
            print(f"Error getting AI recommendations: {e}")
            data['things_to_do'] = data.get('things_to_do') or []
            data['places_to_eat'] = data.get('places_to_eat') or []

    # --- Create DB Objects with new normalized schema ---
    # Find or create Host
    host = Host.query.filter_by(name=data['host_name']).first()
    if not host:
        host = Host(name=data['host_name'])
        db.session.add(host)
    # Update host optional fields
    if 'host_bio' in data and data['host_bio']:
        host.bio = data['host_bio']
    if 'host_photo_url' in data and data['host_photo_url']:
        host.host_image_base64 = data['host_photo_url']

    # Find or create Property
    prop = Property.query.filter_by(name=data['property_name']).first()
    if not prop:
        prop = Property(
            name=data['property_name'],
            address_street=data.get('address_street'),
            address_city_state=data.get('address_city_state'),
            address_zip=data.get('address_zip')
        )
        db.session.add(prop)

    # Find or create Wifi
    wifi = None
    if data.get('wifi_network'):
        wifi = Wifi.query.filter_by(network=data['wifi_network']).first()
        if not wifi:
            wifi = Wifi(network=data['wifi_network'], password=data.get('wifi_password'))
            db.session.add(wifi)
    
    # Flush session to assign IDs to new host, prop, wifi before linking to guidebook
    db.session.flush()

    # Create Guidebook
    selected_template_key = data.get('template_key') if data.get('template_key') in ALLOWED_TEMPLATE_KEYS else 'template_1'
    new_guidebook = Guidebook(
        check_in_time=data.get('check_in_time'),
        check_out_time=data.get('check_out_time'),
        access_info=data.get('access_info'),
        welcome_info=data.get('welcome_message'),
        parking_info=data.get('parking_info'),
        cover_image_url=data.get('cover_image_url'),
        things_to_do=data.get('things_to_do'),
        places_to_eat=data.get('places_to_eat'),
        checkout_info=data.get('checkout_info'),
        template_key=selected_template_key,
        host_id=host.id,
        property_id=prop.id,
        wifi_id=wifi.id if wifi else None
    )
    db.session.add(new_guidebook)

    # Add Rules
    if 'rules' in data and data['rules']:
        for rule_text in data['rules']:
            if rule_text:
                new_rule = Rule(text=rule_text, guidebook=new_guidebook)
                db.session.add(new_rule)

    db.session.commit()

    # Generate PDF from the same data
    # Pass the newly created guidebook object to the PDF generator.
    pdf_bytes = pdf_generator.create_guidebook_pdf(new_guidebook)
    
    # Create the response with the PDF
    response = send_file(
        io.BytesIO(pdf_bytes),
        mimetype='application/pdf',
        as_attachment=True,
        download_name='guidebook.pdf'
    )

    # Add the custom header with the live URL
    response.headers['X-Guidebook-Url'] = f'/guidebook/{new_guidebook.id}'
    response.headers['Access-Control-Expose-Headers'] = 'X-Guidebook-Url'

    return response

def run_startup_migrations():
    """Add missing columns if they don't already exist (Postgres)."""
    stmts = [
        "ALTER TABLE host ADD COLUMN IF NOT EXISTS bio TEXT;",
        "ALTER TABLE host ADD COLUMN IF NOT EXISTS host_image_base64 TEXT;",
        "ALTER TABLE guidebook ADD COLUMN IF NOT EXISTS welcome_info TEXT;",
        "ALTER TABLE guidebook ADD COLUMN IF NOT EXISTS parking_info TEXT;",
        "ALTER TABLE guidebook ADD COLUMN IF NOT EXISTS checkout_info JSON;",
    ]
    for s in stmts:
        try:
            db.session.execute(text(s))
            db.session.commit()
        except Exception as e:
            # Log and continue so the app still boots
            print(f"Migration statement failed or already applied: {s} => {e}")

with app.app_context():
    db.create_all() # Create tables if they don't exist
    run_startup_migrations()

@app.route('/api/ai-food', methods=['POST'])
def ai_food_route():
    data = request.json
    address = data.get('location') or data.get('address')
    num_places_to_eat = data.get('num_places_to_eat', 5)
    if not address or not str(address).strip():
        return jsonify({"error": "Please provide a valid location to generate recommendations."}), 400
    recs = get_ai_food_recommendations(address, num_places_to_eat)
    return jsonify(recs or {"error": "Could not get recommendations"})

@app.route('/api/ai-activities', methods=['POST'])
def ai_activities_route():
    data = request.json
    address = data.get('location') or data.get('address')
    num_things_to_do = data.get('num_things_to_do', 5)
    if not address or not str(address).strip():
        return jsonify({"error": "Please provide a valid location to generate recommendations."}), 400
    recs = get_ai_activity_recommendations(address, num_things_to_do)
    return jsonify(recs or {"error": "Could not get recommendations"})

@app.route('/api/guidebook/<guidebook_id>/template', methods=['POST'])
def update_template_key(guidebook_id):
    gb = Guidebook.query.get_or_404(guidebook_id)
    body = request.json or {}
    new_key = body.get('template_key')
    if new_key not in ALLOWED_TEMPLATE_KEYS:
        return jsonify({"error": "Invalid template_key", "allowed": list(ALLOWED_TEMPLATE_KEYS)}), 400
    gb.template_key = new_key
    db.session.commit()
    return jsonify({"ok": True, "template_key": gb.template_key})

if __name__ == '__main__':
    app.run(debug=True, port=5001)
