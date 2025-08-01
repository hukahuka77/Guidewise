from flask import Flask, request, send_file
from flask_cors import CORS
import main as pdf_generator
import io
import json
import base64

app = Flask(__name__)
CORS(app) # Allow requests from our frontend

@app.route('/api/generate', methods=['POST'])
def generate_guidebook_route():
    data = request.form
    cover_image = request.files.get('coverImage')

    # Map frontend data to the structure our PDF generator expects
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
        # Convert image to base64 data URI
        img_bytes = cover_image.read()
        mime_type = cover_image.mimetype
        base64_encoded_data = base64.b64encode(img_bytes).decode('utf-8')
        guidebook_data['cover_image_url'] = f'data:{mime_type};base64,{base64_encoded_data}'

    # Generate the PDF in memory
    pdf_bytes = pdf_generator.create_guidebook_pdf(guidebook_data)
    
    # Send the PDF back to the client
    return send_file(
        io.BytesIO(pdf_bytes),
        mimetype='application/pdf',
        as_attachment=True,
        download_name='guidebook.pdf'
    )

if __name__ == '__main__':
    app.run(debug=True, port=5001)
