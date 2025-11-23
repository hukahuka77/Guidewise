import os
import requests
from dotenv import load_dotenv

load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

PLACES_TEXT_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json"
PLACES_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"
PLACES_PHOTO_URL = "https://maps.googleapis.com/maps/api/place/photo"
DISTANCE_MATRIX_URL = "https://maps.googleapis.com/maps/api/distancematrix/json"
ROUTES_API_URL = "https://routes.googleapis.com/directions/v2:computeRoutes"

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
    return f"{PLACES_PHOTO_URL}?maxwidth={maxwidth}&photo_reference={photo_reference}&key={GOOGLE_API_KEY}"

def google_distance_matrix(origin, destination):
    """
    Calculate driving distance and time between origin and destination using Routes API (new).
    Falls back to Distance Matrix API (legacy) if Routes API fails.
    Returns: { duration_minutes: int | None, distance_meters: int | None }
    """
    # Try new Routes API first
    try:
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": GOOGLE_API_KEY,
            "X-Goog-FieldMask": "routes.duration,routes.distanceMeters"
        }

        body = {
            "origin": {
                "address": origin
            },
            "destination": {
                "address": destination
            },
            "travelMode": "DRIVE",
            "routingPreference": "TRAFFIC_AWARE"
        }

        resp = requests.post(ROUTES_API_URL, headers=headers, json=body, timeout=10)
        resp.raise_for_status()
        data = resp.json()

        print(f"Routes API response: {data}")

        # Extract route information
        routes = data.get('routes', [])
        if routes:
            route = routes[0]
            duration_str = route.get('duration', '')
            distance_meters = route.get('distanceMeters')

            # Parse duration string (format: "123s")
            duration_seconds = None
            if duration_str and duration_str.endswith('s'):
                try:
                    duration_seconds = int(duration_str[:-1])
                except ValueError:
                    pass

            duration_minutes = round(duration_seconds / 60) if duration_seconds else None

            print(f"Routes API success: {duration_minutes} minutes, {distance_meters} meters")

            return {
                'duration_minutes': duration_minutes,
                'distance_meters': distance_meters
            }
        else:
            print("Routes API returned no routes, trying fallback...")

    except Exception as e:
        print(f"Routes API failed ({e}), falling back to Distance Matrix API...")

    # Fallback to legacy Distance Matrix API
    params = {
        "origins": origin,
        "destinations": destination,
        "mode": "driving",
        "key": GOOGLE_API_KEY
    }
    try:
        resp = requests.get(DISTANCE_MATRIX_URL, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()

        # Check if we got valid results
        if data.get('status') != 'OK':
            print(f"Distance Matrix API returned status: {data.get('status')}")
            return {'duration_minutes': None, 'distance_meters': None}

        rows = data.get('rows', [])
        if not rows:
            print("Distance Matrix API returned no rows")
            return {'duration_minutes': None, 'distance_meters': None}

        elements = rows[0].get('elements', [])
        if not elements:
            print("Distance Matrix API returned no elements")
            return {'duration_minutes': None, 'distance_meters': None}

        element = elements[0]
        if element.get('status') != 'OK':
            print(f"Distance Matrix element status: {element.get('status')}")
            return {'duration_minutes': None, 'distance_meters': None}

        # Extract duration in minutes and distance in meters
        duration_seconds = element.get('duration', {}).get('value')
        distance_meters = element.get('distance', {}).get('value')

        duration_minutes = round(duration_seconds / 60) if duration_seconds else None

        print(f"Distance Matrix API success: {duration_minutes} minutes")

        return {
            'duration_minutes': duration_minutes,
            'distance_meters': distance_meters
        }
    except Exception as e:
        print(f"Error calculating distance: {e}")
        return {'duration_minutes': None, 'distance_meters': None}
