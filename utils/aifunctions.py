import os
import json
from dotenv import load_dotenv
from openai import OpenAI

def get_ai_recommendations(address, num_things_to_do=3, num_places_to_eat=3):
    """Get Things to Do and Places to Eat from OpenAI based on an address."""
    load_dotenv() # Load environment variables from .env file
    try:
        client = OpenAI()
        prompt = f"""
        For the vacation rental located at {address}, 
        please provide a list of local recommendations. 
        I need a JSON object with two keys: 'things_to_do' and 'places_to_eat'. 
        The 'things_to_do' list should contain exactly {num_things_to_do} items, and the 'places_to_eat' list should contain exactly {num_places_to_eat} items. 
        Each item in the lists should be an object with three keys: 'name', 'description', and 'image_url'. 
        The 'image_url' should be a direct link to a high-quality, royalty-free image hosted on a reputable website that visually represents the place or activity. 
        If there is no image available from the actual event or place, we should use a placeholder image from Unsplash or another reputable source.
        Confrim that the image is not a 404 before including it in the JSON object."""

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that provides local recommendations in a strict JSON format."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"}
        )

        recommendations = json.loads(response.choices[0].message.content)
        print("--- OpenAI Response ---")
        print(json.dumps(recommendations, indent=2))
        print("-----------------------")
        return recommendations
    except Exception as e:
        print(f"Could not get AI recommendations: {e}")
        return None

if __name__ == '__main__':
    # This block will only run when the script is executed directly
    # It allows for easy testing of the AI function.
    print("Testing AI function locally...")
    sample_address = "1 Lombard Street, London, UK"
    # Test with custom numbers of recommendations
    recommendations = get_ai_recommendations(sample_address, num_things_to_do=4, num_places_to_eat=2)
    if recommendations:
        print("\nTest successful!")
    else:
        print("\nTest failed.")
