from flask import Flask, request, send_file, jsonify, render_template, make_response
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text
from sqlalchemy.orm import joinedload
import main as pdf_generator
import io
import hashlib
from dotenv import load_dotenv
import os

# Import db and models from models.py
from models import db, Guidebook, Host, Property, Wifi, Rule
from utils.ai_food import get_ai_food_recommendations
from utils.ai_activities import get_ai_activity_recommendations

load_dotenv() # Load environment variables from .env file

app = Flask(__name__)

# Optional gzip compression if Flask-Compress is available
try:
    from flask_compress import Compress
    Compress(app)
except Exception:
    pass

"""
Configure CORS to only allow requests from configured frontend origins and only for /api/* routes.
Set FRONTEND_ORIGIN in backend/.env, e.g.:
  FRONTEND_ORIGIN=http://localhost:3000
You can also provide multiple origins comma-separated.
"""
frontend_origins_env = os.environ.get('FRONTEND_ORIGIN', 'http://localhost:3000')
_origins = [o.strip() for o in frontend_origins_env.split(',') if o.strip()]
CORS(
    app,
    resources={r"/api/*": {"origins": _origins}},
    expose_headers=["X-Guidebook-Url"],
)

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

RENDER_CACHE = {}

def _render_cache_key(gb: Guidebook, template_key: str) -> str:
    ts = getattr(gb, 'last_modified_time', None)
    ts_val = str(ts.timestamp()) if hasattr(ts, 'timestamp') else str(ts)
    return f"{gb.id}:{template_key}:{ts_val}"

@app.route('/guidebook/<guidebook_id>')
def view_guidebook(guidebook_id):
    # Eager-load related objects to avoid N+1 queries
    guidebook = (
        Guidebook.query.options(
            joinedload(Guidebook.host),
            joinedload(Guidebook.property),
            joinedload(Guidebook.wifi),
            joinedload(Guidebook.rules),
        ).get_or_404(guidebook_id)
    )
    # Handle case where wifi might be null (pass through None/empty; template handles conditionals)
    wifi_network = guidebook.wifi.network if guidebook.wifi and guidebook.wifi.network else None
    wifi_password = guidebook.wifi.password if guidebook.wifi and guidebook.wifi.password else None

    template_key = getattr(guidebook, 'template_key', None) or 'template_1'
    template_file = TEMPLATE_REGISTRY.get(template_key, TEMPLATE_REGISTRY['template_1'])
    # Compute included_tabs default (all) if missing; keep any custom_* keys
    base_tabs = ['checkin','property','hostinfo','wifi','food','activities','rules','checkout']
    included_tabs = getattr(guidebook, 'included_tabs', None) or base_tabs
    included_tabs = [t for t in included_tabs if (t in base_tabs) or (isinstance(t, str) and t.startswith('custom_'))]

    # Caching: reuse rendered HTML if guidebook/template unchanged
    cache_key = _render_cache_key(guidebook, template_key)
    etag = hashlib.sha256(cache_key.encode('utf-8')).hexdigest()
    if request.headers.get('If-None-Match') == etag:
        resp = make_response('', 304)
        resp.headers['ETag'] = etag
        return resp

    cached = RENDER_CACHE.get(cache_key)
    if cached is not None:
        resp = make_response(cached)
        resp.headers['Content-Type'] = 'text/html; charset=utf-8'
        resp.headers['ETag'] = etag
        resp.headers['Cache-Control'] = 'public, max-age=300'
        return resp

    html = render_template(
        template_file,
        id=guidebook.id,
        host_name=getattr(guidebook.host, 'name', None),
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
        included_tabs=included_tabs,
        custom_sections=getattr(guidebook, 'custom_sections', None),
        custom_tabs_meta=getattr(guidebook, 'custom_tabs_meta', None),
        cover_image_url=guidebook.cover_image_url,
    )
    RENDER_CACHE[cache_key] = html
    resp = make_response(html)
    resp.headers['Content-Type'] = 'text/html; charset=utf-8'
    resp.headers['ETag'] = etag
    resp.headers['Cache-Control'] = 'public, max-age=300'
    return resp

@app.route('/api/generate', methods=['POST'])
def generate_guidebook_route():
    data = request.json

    # Do not auto-generate recommendations here; leave blank if none provided
    if not isinstance(data.get('things_to_do'), list):
        data['things_to_do'] = []
    if not isinstance(data.get('places_to_eat'), list):
        data['places_to_eat'] = []

    # --- Create DB Objects with new normalized schema ---
    # Find or create Host (optional)
    host = None
    incoming_host_name = (data.get('host_name') or '').strip()
    incoming_host_bio = data.get('host_bio')
    incoming_host_photo = data.get('host_photo_url')
    if incoming_host_name or incoming_host_bio or incoming_host_photo:
        if incoming_host_name:
            host = Host.query.filter_by(name=incoming_host_name).first()
        if not host:
            host = Host(name=incoming_host_name or None)
            db.session.add(host)
        # Update host optional fields
        if incoming_host_bio:
            host.bio = incoming_host_bio
        if incoming_host_photo:
            host.host_image_base64 = incoming_host_photo

    # Find or create Property (update fields if it already exists)
    prop = Property.query.filter_by(name=data['property_name']).first()
    if not prop:
        prop = Property(
            name=data['property_name'],
            address_street=data.get('address_street'),
            address_city_state=data.get('address_city_state'),
            address_zip=data.get('address_zip')
        )
        db.session.add(prop)
    else:
        # Update existing property details with latest values if provided
        if 'address_street' in data:
            prop.address_street = data.get('address_street')
        if 'address_city_state' in data:
            prop.address_city_state = data.get('address_city_state')
        if 'address_zip' in data:
            prop.address_zip = data.get('address_zip')

    # Find or create Wifi (update password if it already exists)
    wifi = None
    if data.get('wifi_network'):
        wifi = Wifi.query.filter_by(network=data['wifi_network']).first()
        if not wifi:
            wifi = Wifi(network=data['wifi_network'], password=data.get('wifi_password'))
            db.session.add(wifi)
        else:
            if 'wifi_password' in data:
                wifi.password = data.get('wifi_password')
    
    # Flush session to assign IDs to new host, prop, wifi before linking to guidebook
    db.session.flush()

    # Create Guidebook
    selected_template_key = data.get('template_key') if data.get('template_key') in ALLOWED_TEMPLATE_KEYS else 'template_1'
    # Validate included_tabs: allow base tabs + any keys starting with custom_
    base_tabs = {'checkin','property','hostinfo','wifi','food','activities','rules','checkout'}
    incoming_tabs = data.get('included_tabs')
    if not isinstance(incoming_tabs, list):
        incoming_tabs = list(base_tabs)
    included_tabs = []
    for t in incoming_tabs:
        if isinstance(t, str) and (t in base_tabs or t.startswith('custom_')):
            included_tabs.append(t)

    # Custom sections payload: map custom tab key -> list of strings
    custom_sections = {}
    if isinstance(data.get('custom_sections'), dict):
        for k, v in data.get('custom_sections', {}).items():
            if isinstance(k, str) and k.startswith('custom_'):
                # normalize to list of strings
                if isinstance(v, list):
                    custom_sections[k] = [str(x) for x in v if x is not None]

    # Custom tabs meta: map custom key -> { label, icon }
    custom_tabs_meta = {}
    if isinstance(data.get('custom_tabs_meta'), dict):
        for k, v in data.get('custom_tabs_meta', {}).items():
            if isinstance(k, str) and k.startswith('custom_') and isinstance(v, dict):
                label = v.get('label')
                icon = v.get('icon')
                custom_tabs_meta[k] = {
                    'label': str(label) if label is not None else '',
                    'icon': str(icon) if icon is not None else ''
                }

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
        included_tabs=included_tabs,
        custom_sections=custom_sections,
        custom_tabs_meta=custom_tabs_meta if custom_tabs_meta else None,
        template_key=selected_template_key,
        host_id=host.id if host else None,
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

    # Do NOT generate the PDF here. Return JSON with identifiers and the live URL header.
    resp = jsonify({
        "ok": True,
        "guidebook_id": new_guidebook.id,
        "template_key": selected_template_key,
    })
    resp.headers['X-Guidebook-Url'] = f'/guidebook/{new_guidebook.id}'
    resp.headers['Access-Control-Expose-Headers'] = 'X-Guidebook-Url'
    return resp, 201

def run_startup_migrations():
    """Add missing columns if they don't already exist (Postgres)."""
    stmts = [
        "ALTER TABLE host ADD COLUMN IF NOT EXISTS bio TEXT;",
        "ALTER TABLE host ADD COLUMN IF NOT EXISTS host_image_base64 TEXT;",
        "ALTER TABLE guidebook ADD COLUMN IF NOT EXISTS welcome_info TEXT;",
        "ALTER TABLE guidebook ADD COLUMN IF NOT EXISTS parking_info TEXT;",
        "ALTER TABLE guidebook ADD COLUMN IF NOT EXISTS checkout_info JSON;",
        "ALTER TABLE guidebook ADD COLUMN IF NOT EXISTS included_tabs JSON;",
        "ALTER TABLE guidebook ADD COLUMN IF NOT EXISTS custom_sections JSON;",
        "ALTER TABLE guidebook ADD COLUMN IF NOT EXISTS custom_tabs_meta JSON;",
        # Timestamps
        "ALTER TABLE guidebook ADD COLUMN IF NOT EXISTS created_time TIMESTAMPTZ DEFAULT NOW();",
        "ALTER TABLE guidebook ADD COLUMN IF NOT EXISTS last_modified_time TIMESTAMPTZ DEFAULT NOW();",
        # Make host name and guidebook.host_id optional
        "ALTER TABLE host ALTER COLUMN name DROP NOT NULL;",
        "ALTER TABLE guidebook ALTER COLUMN host_id DROP NOT NULL;",
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

# In-memory cache for generated PDFs for the lifetime of the process
PDF_CACHE = {}

def _pdf_cache_key(guidebook: Guidebook, template_key: str) -> str:
    # Use id + template; include last_modified_time when available for better busting
    ts = getattr(guidebook, 'last_modified_time', None)
    ts_val = str(ts.timestamp()) if hasattr(ts, 'timestamp') else str(ts)
    return f"{guidebook.id}:{template_key}:{ts_val}"

@app.route('/api/guidebook/<guidebook_id>/pdf', methods=['GET'])
def get_pdf_on_demand(guidebook_id):
    gb = Guidebook.query.get_or_404(guidebook_id)
    requested_template = request.args.get('template')
    want_download = str(request.args.get('download', '0')).lower() in ('1', 'true', 'yes')
    # Choose a valid template: request > guidebook > default
    chosen_template = None
    if requested_template in ALLOWED_TEMPLATE_KEYS:
        chosen_template = requested_template
    elif getattr(gb, 'template_key', None) in ALLOWED_TEMPLATE_KEYS:
        chosen_template = gb.template_key
    else:
        chosen_template = 'template_1'

    cache_key = _pdf_cache_key(gb, chosen_template)
    etag = hashlib.sha256(cache_key.encode('utf-8')).hexdigest()
    if request.headers.get('If-None-Match') == etag:
        resp = make_response('', 304)
        resp.headers['ETag'] = etag
        return resp

    cached = PDF_CACHE.get(cache_key)
    if cached:
        resp = send_file(
            io.BytesIO(cached),
            mimetype='application/pdf',
            as_attachment=want_download,
            download_name='guidebook.pdf'
        )
        resp.headers['ETag'] = etag
        resp.headers['Cache-Control'] = 'public, max-age=3600'
        return resp

    # Generate PDF lazily. If the generator reads gb.template_key, temporarily override.
    original_template = getattr(gb, 'template_key', None)
    try:
        gb.template_key = chosen_template
        pdf_bytes = pdf_generator.create_guidebook_pdf(gb)
    finally:
        gb.template_key = original_template

    PDF_CACHE[cache_key] = pdf_bytes
    resp = send_file(
        io.BytesIO(pdf_bytes),
        mimetype='application/pdf',
        as_attachment=want_download,
        download_name='guidebook.pdf'
    )
    resp.headers['ETag'] = etag
    resp.headers['Cache-Control'] = 'public, max-age=3600'
    return resp

if __name__ == '__main__':
    app.run(debug=True, port=5001)
