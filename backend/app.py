from flask import Flask, request, send_file, render_template, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
import main as pdf_generator
import io
import json
import base64
import uuid
from dotenv import load_dotenv
import os

load_dotenv() # Load environment variables from .env file

app = Flask(__name__)
CORS(app)

# Configure the database using the DATABASE_URL from .env, with a fallback to SQLite
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

class Guidebook(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    property_name = db.Column(db.String(100), nullable=False)
    host_name = db.Column(db.String(100))
    wifi_network = db.Column(db.String(100))
    wifi_password = db.Column(db.String(100))
    check_in_time = db.Column(db.String(20))
    check_out_time = db.Column(db.String(20))
    address = db.Column(db.String(200))
    address_street = db.Column(db.String(100))
    address_city_state = db.Column(db.String(100))
    address_zip = db.Column(db.String(20))
    access_info = db.Column(db.Text)
    rules = db.Column(db.JSON)
    num_things_to_do = db.Column(db.Integer)
    num_places_to_eat = db.Column(db.Integer)
    cover_image_url = db.Column(db.Text)
    things_to_do = db.Column(db.JSON)
    places_to_eat = db.Column(db.JSON)

@app.route('/guidebook/<guidebook_id>')
def view_guidebook(guidebook_id):
    guidebook = Guidebook.query.get_or_404(guidebook_id)
    return render_template('guidebook_url_template.html', **guidebook.__dict__)

@app.route('/api/generate', methods=['POST'])
def generate_guidebook_route():
    data = request.form
    cover_image = request.files.get('coverImage')

    guidebook_data = {
        'property_name': data.get('propertyName'),
        'host_name': data.get('hostName'),
        'wifi_network': data.get('wifiNetwork'),
        'wifi_password': data.get('wifiPassword'),
        'check_in_time': data.get('checkInTime'),
        'check_out_time': data.get('checkOutTime'),
        'address': data.get('address'),
        'address_street': data.get('address_street'),
        'address_city_state': data.get('address_city_state'),
        'address_zip': data.get('address_zip'),
        'access_info': data.get('access_info'),
        'rules': json.loads(data.get('rules', '[]')),
        'num_things_to_do': data.get('thingsToDo'),
        'num_places_to_eat': data.get('placesToEat'),
    }

    if cover_image:
        img_bytes = cover_image.read()
        mime_type = cover_image.mimetype
        base64_encoded_data = base64.b64encode(img_bytes).decode('utf-8')
        guidebook_data['cover_image_url'] = f'data:{mime_type};base64,{base64_encoded_data}'

    # Save to database
    # Get AI recommendations
    from utils.aifunctions import get_ai_recommendations
    recommendations = get_ai_recommendations(
        guidebook_data['address'], 
        guidebook_data['num_things_to_do'], 
        guidebook_data['num_places_to_eat']
    )
    guidebook_data['things_to_do'] = recommendations.get('things_to_do', [])
    guidebook_data['places_to_eat'] = recommendations.get('places_to_eat', [])

    # Save to database
    new_guidebook = Guidebook(**guidebook_data)
    db.session.add(new_guidebook)
    db.session.commit()

    # Generate PDF from the same data
    # We need to get AI recommendations first, which happens in create_guidebook_pdf
    pdf_bytes = pdf_generator.create_guidebook_pdf(guidebook_data)
    
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

with app.app_context():
    db.create_all() # Create tables if they don't exist

if __name__ == '__main__':
    app.run(debug=True, port=5001)
