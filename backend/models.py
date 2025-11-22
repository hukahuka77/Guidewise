import uuid
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Host(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=True)
    bio = db.Column(db.Text, nullable=True)
    contact = db.Column(db.Text, nullable=True)
    # Preferred: URL to a hosted image (Supabase Storage)
    host_image_url = db.Column(db.Text, nullable=True)
    # Ownership: Supabase user ID (UUID as string)
    user_id = db.Column(db.String(36), index=True, nullable=True)
    guidebooks = db.relationship('Guidebook', backref='host', lazy=True)

class Property(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    address_street = db.Column(db.String(100))
    address_city_state = db.Column(db.String(100))
    address_zip = db.Column(db.String(50))
    # Ownership: Supabase user ID (UUID as string)
    user_id = db.Column(db.String(36), index=True, nullable=True)
    guidebooks = db.relationship('Guidebook', backref='property', lazy=True)

class Guidebook(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    check_in_time = db.Column(db.String(20))
    check_out_time = db.Column(db.String(20))
    access_info = db.Column(db.String(255), nullable=True)
    welcome_info = db.Column(db.Text, nullable=True)
    parking_info = db.Column(db.Text, nullable=True)
    cover_image_url = db.Column(db.Text, nullable=True)
    # Safety info stored as JSON: { emergency_contact: str, fire_extinguisher_location: str }
    safety_info = db.Column(db.JSON)
    things_to_do = db.Column(db.JSON)
    places_to_eat = db.Column(db.JSON)
    checkout_info = db.Column(db.JSON)
    # List of objects: [{ name: string, description: string }]
    house_manual = db.Column(db.JSON)
    # List of objects: [{ name: string, description: string }] - new JSON format for rules
    rules_json = db.Column(db.JSON)
    # WiFi info stored as JSON: { network: str, password: str }
    wifi_json = db.Column(db.JSON)
    included_tabs = db.Column(db.JSON)
    # Map of custom tab key -> list of strings (content blocks)
    custom_sections = db.Column(db.JSON)
    # Map of custom tab key -> { label: string, icon: string }
    custom_tabs_meta = db.Column(db.JSON)
    # Timestamps
    created_time = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), nullable=False)
    last_modified_time = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), onupdate=db.func.now(), nullable=False)

    # Selected template (canonical keys: 'template_original', 'template_generic')
    template_key = db.Column(db.String(50), nullable=False, default='template_original')

    # Ownership: Supabase user ID (UUID as string)
    user_id = db.Column(db.String(36), index=True, nullable=True)

    # Lifecycle fields: active (published) vs preview mode
    active = db.Column(db.Boolean, nullable=False, default=False)
    public_slug = db.Column(db.String(120), unique=True, nullable=True)

    # Foreign Keys
    host_id = db.Column(db.Integer, db.ForeignKey('host.id'), nullable=True)
    property_id = db.Column(db.Integer, db.ForeignKey('property.id'), nullable=False)

    # Snapshot fields for fast live serving
    published_html = db.Column(db.Text, nullable=True)
    published_etag = db.Column(db.String(64), nullable=True)
    published_at = db.Column(db.DateTime(timezone=True), nullable=True)
