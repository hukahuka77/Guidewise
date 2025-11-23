import os
import json
from dotenv import load_dotenv
from openai import OpenAI
from .google_places import google_places_text_search, google_places_details, google_distance_matrix

load_dotenv()

# Configuration for different recommendation types
RECOMMENDATION_CONFIGS = {
    "food": {
        "model": "gpt-4-1106-preview",
        "system_prompt": "You are a helpful assistant that provides diverse, highly-rated restaurant and food recommendations.",
        "user_prompt_template": """Provide a JSON object with a key '{response_key}' containing a list of {num_items} diverse, highly-rated restaurants or food spots near {address}.
        Each item must have 'name', 'address', and a brief 'description'.
        The 'address' should be the real-world street address of the restaurant or place, as specific as possible (street, city, zip, etc).
        The list should contain exactly {num_items} items.
        Do NOT include any image URLs or keys for images.""",
        "response_keys": ["restaurants", "places_to_eat", "food"],
        "default_response_key": "places_to_eat"
    },
    "activities": {
        "model": "gpt-4o",
        "system_prompt": "You are a helpful assistant that provides local activities and things to do in a strict JSON format.",
        "user_prompt_template": """For the vacation rental located at {address},
        please provide a list of local activities and things to do.
        I need a JSON object with a key '{response_key}' containing an array of {num_items} items.
        Each item should be an object with three keys: 'name', 'address', and 'description'.
        The 'address' should be the real-world street address of the activity or place, as specific as possible (street, city, zip, etc).
        The list should contain exactly {num_items} items.
        Do NOT include any image URLs or keys for images.""",
        "response_keys": ["activities", "things_to_do", "activityItems"],
        "default_response_key": "activities"
    },
    "nightlife": {
        "model": "gpt-4o",
        "system_prompt": "You are a helpful assistant that provides nightlife and entertainment recommendations.",
        "user_prompt_template": """Provide a JSON object with a key '{response_key}' containing a list of {num_items} popular nightlife spots, bars, clubs, or entertainment venues near {address}.
        Each item must have 'name', 'address', and a brief 'description'.
        The 'address' should be the real-world street address, as specific as possible (street, city, zip, etc).
        The list should contain exactly {num_items} items.
        Do NOT include any image URLs or keys for images.""",
        "response_keys": ["nightlife", "entertainment", "bars", "venues"],
        "default_response_key": "nightlife"
    }
}


def get_ai_recommendations(
    recommendation_type: str,
    address: str,
    num_items: int = 5
) -> list:
    """
    Unified AI recommendation engine that fetches recommendations from OpenAI
    and enriches them with Google Places data.

    Args:
        recommendation_type: Type of recommendations ("food", "activities", "nightlife", etc.)
        address: Location to get recommendations for
        num_items: Number of items to recommend (default: 5)

    Returns:
        List of enriched recommendations with name, address, description, photo_reference

    Raises:
        ValueError: If recommendation_type is not configured
    """

    # Validate recommendation type
    if recommendation_type not in RECOMMENDATION_CONFIGS:
        raise ValueError(
            f"Unknown recommendation type: {recommendation_type}. "
            f"Available types: {', '.join(RECOMMENDATION_CONFIGS.keys())}"
        )

    config = RECOMMENDATION_CONFIGS[recommendation_type]

    try:
        # Initialize OpenAI client
        client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

        # Build the prompt
        user_prompt = config["user_prompt_template"].format(
            address=address,
            num_items=num_items,
            response_key=config["default_response_key"]
        )

        # Call OpenAI API
        response = client.chat.completions.create(
            model=config["model"],
            messages=[
                {"role": "system", "content": config["system_prompt"]},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"}
        )

        # Parse the response
        raw_response = response.choices[0].message.content
        parsed_response = json.loads(raw_response)

        # Extract items from response (try multiple possible keys)
        items = _extract_items_from_response(parsed_response, config["response_keys"])

        if not items:
            print(f"WARNING: No items found in OpenAI response for {recommendation_type}")
            return []

        # Enrich each item with Google Places data
        enriched_items = _enrich_with_google_places(items, address)

        print(f"--- Enhanced {recommendation_type.title()} Response ---")
        print(json.dumps(enriched_items, indent=2))

        return enriched_items

    except Exception as e:
        print(f"ERROR in get_ai_recommendations({recommendation_type}): {e}")
        return []


def _extract_items_from_response(response_data: dict | list, possible_keys: list) -> list:
    """
    Extract items array from OpenAI response, trying multiple possible keys.

    Args:
        response_data: Parsed JSON response from OpenAI
        possible_keys: List of keys to try (e.g., ["restaurants", "places_to_eat"])

    Returns:
        List of items, or empty list if not found
    """
    # If response is already a list, return it
    if isinstance(response_data, list):
        return response_data

    # If response is a dict, try to find the array under known keys
    if isinstance(response_data, dict):
        for key in possible_keys:
            if key in response_data and isinstance(response_data[key], list):
                return response_data[key]

    return []


def _enrich_with_google_places(items: list, location: str) -> list:
    """
    Enrich recommendation items with Google Places data (real address, photo, driving distance).

    Args:
        items: List of items from OpenAI (each with name, address, description)
        location: General location for Google Places search (also used as origin for distance calculation)

    Returns:
        List of enriched items with photo_reference and driving_minutes fields
    """
    enriched = []

    for item in items:
        name = item.get("name")
        item_address = item.get("address")
        description = item.get("description", "")

        if not name or not item_address:
            print(f"WARNING: Skipping item with missing name or address: {item}")
            continue

        # Search Google Places
        query = f"{name}, {item_address}"
        search_results = google_places_text_search(query, location=location)

        # If we found a match, enrich the data
        if search_results.get("results"):
            place = search_results["results"][0]
            place_id = place.get("place_id")

            if place_id:
                # Get detailed place information
                details = google_places_details(place_id)
                details_result = details.get("result", {})

                # Get real address
                real_address = (
                    details_result.get("formatted_address") or
                    place.get("formatted_address") or
                    item_address
                )

                # Get photo reference
                photos = details_result.get("photos") or place.get("photos")
                photo_reference = None
                if photos and len(photos) > 0:
                    photo_reference = photos[0].get("photo_reference")

                # Calculate driving distance from property location
                driving_minutes = None
                if location and real_address:
                    print(f"Calculating distance from '{location}' to '{real_address}'")
                    distance_data = google_distance_matrix(location, real_address)
                    driving_minutes = distance_data.get('duration_minutes')
                    print(f"Distance result for {name}: {driving_minutes} minutes")

                # Add enriched item
                enriched.append({
                    "name": name,
                    "address": real_address,
                    "description": description,
                    "photo_reference": photo_reference,
                    "driving_minutes": driving_minutes
                })
            else:
                print(f"WARNING: No place_id for {name}, skipping")
        else:
            print(f"WARNING: No Google Places results for {name}, skipping")

    return enriched


def add_recommendation_type(
    type_name: str,
    model: str,
    system_prompt: str,
    user_prompt_template: str,
    response_keys: list,
    default_response_key: str
):
    """
    Dynamically add a new recommendation type configuration.

    Example:
        add_recommendation_type(
            type_name="shopping",
            model="gpt-4o",
            system_prompt="You are a helpful assistant that provides shopping recommendations.",
            user_prompt_template="Provide {num_items} shopping destinations near {address}...",
            response_keys=["shopping", "stores", "shops"],
            default_response_key="shopping"
        )
    """
    RECOMMENDATION_CONFIGS[type_name] = {
        "model": model,
        "system_prompt": system_prompt,
        "user_prompt_template": user_prompt_template,
        "response_keys": response_keys,
        "default_response_key": default_response_key
    }
    print(f"Added new recommendation type: {type_name}")


# Backward compatibility functions
def get_ai_food_recommendations(address: str, num_places_to_eat: int = 5) -> list:
    """Legacy function for backward compatibility."""
    return get_ai_recommendations("food", address, num_places_to_eat)


def get_ai_activity_recommendations(address: str, num_things_to_do: int = 5) -> dict:
    """Legacy function for backward compatibility."""
    activities = get_ai_recommendations("activities", address, num_things_to_do)
    return {"activities": activities}
