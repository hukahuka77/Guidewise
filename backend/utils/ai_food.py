import os
import json
from dotenv import load_dotenv
from openai import OpenAI
from .google_places import google_places_text_search, google_places_details, google_places_photo_url

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

def get_ai_food_recommendations(address, num_places_to_eat=5):
    try:
        prompt = f"""Provide a JSON object with a key 'places_to_eat' containing a list of {num_places_to_eat} diverse, highly-rated restaurants or food spots near {address}. Each item must have 'name', 'address', and a brief 'description'.
        The 'address' should be the real-world street address of the restaurant or place, as specific as possible (street, city, zip, etc).
        The list should contain exactly {num_places_to_eat} items.
        Do NOT include any image URLs or keys for images.
        """

        response = client.chat.completions.create(
            model="gpt-4-1106-preview",
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful assistant that provides travel recommendations."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            response_format={"type": "json_object"}
        )

        food_recs_raw = response.choices[0].message.content
        food_recs = json.loads(food_recs_raw)

        items = []
        if isinstance(food_recs, list):
            items = food_recs
        elif isinstance(food_recs, dict):
            for key in ["restaurants", "places_to_eat", "food"]:
                if key in food_recs and isinstance(food_recs[key], list):
                    items = food_recs[key]
                    break
        else:
            return []

        enhanced = []
        for i, item in enumerate(items):
            name = item.get("name")
            item_address = item.get("address")
            description = item.get("description", "")

            query = f"{name}, {item_address}"
            search = google_places_text_search(query, location=address)

            if search.get("results"):
                place = search["results"][0]
                place_id = place["place_id"]
                details = google_places_details(place_id)
                details_result = details.get("result", {})
                real_address = details_result.get("formatted_address") or place.get("formatted_address")
                
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

        print("--- Enhanced Food Response ---")
        print(json.dumps(enhanced, indent=2))
        return enhanced

    except Exception as e:
        print(f"ERROR in get_ai_food_recommendations: {e}")
        return []
