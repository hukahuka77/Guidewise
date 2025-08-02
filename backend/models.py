import uuid
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Host(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    guidebooks = db.relationship('Guidebook', backref='host', lazy=True)

class Property(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    address_street = db.Column(db.String(100))
    address_city_state = db.Column(db.String(100))
    address_zip = db.Column(db.String(50))
    guidebooks = db.relationship('Guidebook', backref='property', lazy=True)

class Wifi(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    network = db.Column(db.String(100), nullable=False)
    password = db.Column(db.String(100))
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
    cover_image_url = db.Column(db.Text, nullable=True)
    things_to_do = db.Column(db.JSON)
    places_to_eat = db.Column(db.JSON)

    # Foreign Keys
    host_id = db.Column(db.Integer, db.ForeignKey('host.id'), nullable=False)
    property_id = db.Column(db.Integer, db.ForeignKey('property.id'), nullable=False)
    wifi_id = db.Column(db.Integer, db.ForeignKey('wifi.id'))

    # Relationships
    rules = db.relationship('Rule', backref='guidebook', lazy=True, cascade="all, delete-orphan")
