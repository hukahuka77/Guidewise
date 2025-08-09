import os
import requests
from dotenv import load_dotenv

load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

PLACES_TEXT_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json"
PLACES_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"
PLACES_PHOTO_URL = "https://maps.googleapis.com/maps/api/place/photo"

def google_places_text_search(query, location=None):
    params = {
        "query": query,
        "key": GOOGLE_API_KEY
    }
    if location:
        params["location"] = location
    resp = requests.get(PLACES_TEXT_SEARCH_URL, params=params, timeout=10)
    print(f"DEBUG: Google Places Raw Response for query '{query}': {resp.text}")
    resp.raise_for_status()
    return resp.json()

def google_places_details(place_id):
    params = {
        "place_id": place_id,
        "fields": "name,formatted_address,photos,website,rating,geometry,types",
        "key": GOOGLE_API_KEY
    }
    resp = requests.get(PLACES_DETAILS_URL, params=params, timeout=10)
    resp.raise_for_status()
    return resp.json()

def google_places_photo_url(photo_reference, maxwidth=800):
    return f"{PLACES_PHOTO_URL}?maxwidth={maxwidth}&photoreference={photo_reference}&key={GOOGLE_API_KEY}"
