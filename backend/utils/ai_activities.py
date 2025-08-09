import os
import json
from dotenv import load_dotenv
from openai import OpenAI
from utils.google_places import google_places_text_search, google_places_details, google_places_photo_url

def get_ai_activity_recommendations(address, num_things_to_do=5):
    """Get Things to Do from OpenAI based on an address."""
    load_dotenv()
    try:
        client = OpenAI()
        prompt = f"""
        For the vacation rental located at {address}, 
        please provide a list of local activities and things to do. 
        I need a JSON array, each item an object with three keys: 'name', 'address', and 'description'.
        The 'address' should be the real-world street address of the activity or place, as specific as possible (street, city, zip, etc). 
        The list should contain exactly {num_things_to_do} items. 
        Do NOT include any image URLs or keys for images.
        """

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that provides local activities and things to do in a strict JSON array format."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"}
        )

        activity_recs = json.loads(response.choices[0].message.content)

        # Determine correct key/array
        items = []
        if isinstance(activity_recs, list):
            items = activity_recs
        elif isinstance(activity_recs, dict):
            for key in ["activities", "things_to_do", "activityItems"]:
                if key in activity_recs and isinstance(activity_recs[key], list):
                    items = activity_recs[key]
                    break
        else:
            return []

        enhanced = []
        for item in items:
            name = item.get("name")
            description = item.get("description", "")
            item_address = item.get("address")
            query = f"{name}, {item_address}"
            # Google Places Text Search
            search = google_places_text_search(query, location=address)
            if search.get("results"):
                place = search["results"][0]
                place_id = place["place_id"]
                details = google_places_details(place_id)
                details_result = details.get("result", {})
                real_address = details_result.get("formatted_address") or place.get("formatted_address")

                # Try to get a photo
                photos = details_result.get("photos") or place.get("photos")
                image_url = None
                if photos and len(photos) > 0:
                    image_url = google_places_photo_url(photos[0]["photo_reference"])

                enhanced.append({
                    "name": name,
                    "address": real_address,
                    "description": description,
                    "image_url": image_url
                })
            # If no results from Google, we simply skip this item.

        return {"activities": enhanced}
    except Exception as e:
        print(f"Could not get AI activities recommendations: {e}")
        return None
