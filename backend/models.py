import uuid
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Host(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=True)
    bio = db.Column(db.Text, nullable=True)
    contact = db.Column(db.Text, nullable=True)
    host_image_base64 = db.Column(db.Text, nullable=True)
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

class Wifi(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    network = db.Column(db.String(100), nullable=False)
    password = db.Column(db.String(100))
    # Ownership: Supabase user ID (UUID as string)
    user_id = db.Column(db.String(36), index=True, nullable=True)
    guidebooks = db.relationship('Guidebook', backref='wifi', lazy=True)

class Rule(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.String(255), nullable=False)
    guidebook_id = db.Column(db.String(36), db.ForeignKey('guidebook.id'), nullable=False)

class Guidebook(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    check_in_time = db.Column(db.String(20))
    check_out_time = db.Column(db.String(20))
    access_info = db.Column(db.String(255), nullable=True)
    welcome_info = db.Column(db.Text, nullable=True)
    parking_info = db.Column(db.Text, nullable=True)
    cover_image_url = db.Column(db.Text, nullable=True)
    things_to_do = db.Column(db.JSON)
    places_to_eat = db.Column(db.JSON)
    checkout_info = db.Column(db.JSON)
    included_tabs = db.Column(db.JSON)
    # Map of custom tab key -> list of strings (content blocks)
    custom_sections = db.Column(db.JSON)
    # Map of custom tab key -> { label: string, icon: string }
    custom_tabs_meta = db.Column(db.JSON)
    # Timestamps
    created_time = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), nullable=False)
    last_modified_time = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), onupdate=db.func.now(), nullable=False)

    # Selected template (e.g., 'template_1' or 'template_2')
    template_key = db.Column(db.String(50), nullable=False, default='template_1')

    # Ownership: Supabase user ID (UUID as string)
    user_id = db.Column(db.String(36), index=True, nullable=True)

    # Foreign Keys
    host_id = db.Column(db.Integer, db.ForeignKey('host.id'), nullable=True)
    property_id = db.Column(db.Integer, db.ForeignKey('property.id'), nullable=False)
    wifi_id = db.Column(db.Integer, db.ForeignKey('wifi.id'))

    # Relationships
    rules = db.relationship('Rule', backref='guidebook', lazy=True, cascade="all, delete-orphan")
