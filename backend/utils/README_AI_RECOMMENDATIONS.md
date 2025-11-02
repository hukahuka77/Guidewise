# AI Recommendations System

This unified AI recommendation engine combines OpenAI's GPT models with Google Places API to generate enriched, location-based recommendations.

## Features

- **Unified codebase**: Single implementation for all recommendation types
- **Extensible**: Easily add new recommendation types (shopping, spas, coffee shops, etc.)
- **Google Places enrichment**: Automatic validation with real addresses and photos
- **Backward compatible**: Legacy functions still work

## Current Recommendation Types

1. **food** - Restaurants and dining
2. **activities** - Things to do, attractions
3. **nightlife** - Bars, clubs, entertainment venues

## Usage

### Basic Usage

```python
from utils.ai_recommendations import get_ai_recommendations

# Get food recommendations
restaurants = get_ai_recommendations("food", "123 Main St, San Francisco, CA", num_items=5)

# Get activities
activities = get_ai_recommendations("activities", "Miami Beach, FL", num_items=5)

# Get nightlife
nightlife = get_ai_recommendations("nightlife", "Las Vegas, NV", num_items=5)
```

### API Endpoints

#### Generic Endpoint (Recommended)
```bash
POST /api/ai-recommendations
Content-Type: application/json

{
  "type": "food",           # or "activities", "nightlife"
  "location": "New York, NY",
  "num_items": 5            # optional, defaults to 5
}
```

#### Legacy Endpoints (Still supported)
```bash
POST /api/ai-food
{
  "location": "New York, NY",
  "num_places_to_eat": 5
}

POST /api/ai-activities
{
  "location": "New York, NY",
  "num_things_to_do": 5
}
```

### Response Format

All endpoints return an array of enriched recommendations:

```json
[
  {
    "name": "Joe's Pizza",
    "address": "7 Carmine St, New York, NY 10014",
    "description": "Famous NYC pizza spot with classic slices",
    "photo_reference": "AW30NDxr..."
  },
  {
    "name": "Blue Hill",
    "address": "75 Washington Pl, New York, NY 10011",
    "description": "Farm-to-table fine dining",
    "photo_reference": "AW30NDyz..."
  }
]
```

## Adding New Recommendation Types

### Method 1: Configuration (Recommended)

Add a new type to `RECOMMENDATION_CONFIGS` in `ai_recommendations.py`:

```python
RECOMMENDATION_CONFIGS = {
    # ... existing types ...
    "shopping": {
        "model": "gpt-4o",
        "system_prompt": "You are a helpful assistant that provides shopping recommendations.",
        "user_prompt_template": """Provide a JSON object with a key '{response_key}' containing a list of {num_items} popular shopping destinations near {address}.
        Each item must have 'name', 'address', and a brief 'description'.
        The 'address' should be the real-world street address, as specific as possible.
        The list should contain exactly {num_items} items.
        Do NOT include any image URLs or keys for images.""",
        "response_keys": ["shopping", "stores", "shops"],
        "default_response_key": "shopping"
    }
}
```

### Method 2: Dynamic Registration

Add types programmatically at runtime:

```python
from utils.ai_recommendations import add_recommendation_type

add_recommendation_type(
    type_name="coffee",
    model="gpt-4o",
    system_prompt="You are a helpful assistant that provides coffee shop recommendations.",
    user_prompt_template="Provide {num_items} great coffee shops near {address}...",
    response_keys=["coffee_shops", "cafes", "coffee"],
    default_response_key="coffee_shops"
)

# Now you can use it
coffee_shops = get_ai_recommendations("coffee", "Seattle, WA", num_items=5)
```

## Configuration Options

Each recommendation type requires:

| Field | Description | Example |
|-------|-------------|---------|
| `model` | OpenAI model to use | `"gpt-4o"`, `"gpt-4-1106-preview"` |
| `system_prompt` | System message for the AI | `"You are a helpful assistant..."` |
| `user_prompt_template` | Template for the user prompt | Must include `{address}`, `{num_items}`, `{response_key}` placeholders |
| `response_keys` | Possible keys in AI response | `["restaurants", "places_to_eat"]` |
| `default_response_key` | Key to request from AI | `"restaurants"` |

## How It Works

1. **OpenAI Generation**: Generates recommendations based on location
2. **Google Places Search**: Validates each recommendation exists
3. **Google Places Details**: Enriches with real address and photo
4. **Photo Reference**: Returns Google photo reference (use with `/api/place-photo`)

## Error Handling

The system gracefully handles errors:

- Missing/invalid location → 400 error
- Unknown recommendation type → 400 error with available types
- OpenAI failure → Returns empty array with logged error
- Google Places not found → Skips that item (doesn't fail entire request)

## Best Practices

1. **Use specific addresses**: "123 Main St, San Francisco, CA" > "California"
2. **Reasonable num_items**: 3-10 items work best (API costs scale with count)
3. **Cache results**: Store in frontend to avoid repeated API calls
4. **Handle empty results**: Always check if array is empty

## Examples

### Add Spa Recommendations

```python
# In ai_recommendations.py
RECOMMENDATION_CONFIGS["spas"] = {
    "model": "gpt-4o",
    "system_prompt": "You are a helpful assistant that provides spa and wellness recommendations.",
    "user_prompt_template": """Provide a JSON object with a key 'spas' containing {num_items} highly-rated spas and wellness centers near {address}.
    Each item must have 'name', 'address', and 'description'.
    The list should contain exactly {num_items} items.""",
    "response_keys": ["spas", "wellness", "spa_centers"],
    "default_response_key": "spas"
}
```

Then use it:
```bash
POST /api/ai-recommendations
{
  "type": "spas",
  "location": "Sedona, AZ",
  "num_items": 3
}
```

### Add Pet-Friendly Places

```python
RECOMMENDATION_CONFIGS["pet_friendly"] = {
    "model": "gpt-4o",
    "system_prompt": "You are a helpful assistant that provides pet-friendly venue recommendations.",
    "user_prompt_template": """Provide {num_items} pet-friendly venues (parks, cafes, stores) near {address}.
    Format: JSON object with 'pet_friendly' key containing array of items.
    Each item: name, address, description.
    The list should contain exactly {num_items} items.""",
    "response_keys": ["pet_friendly", "dog_friendly", "pet_venues"],
    "default_response_key": "pet_friendly"
}
```

## Migration from Old System

### Before (Duplicated)
```python
from utils.ai_food import get_ai_food_recommendations
from utils.ai_activities import get_ai_activity_recommendations

food = get_ai_food_recommendations("NYC", 5)
activities = get_ai_activity_recommendations("NYC", 5)
```

### After (Unified)
```python
from utils.ai_recommendations import get_ai_recommendations

food = get_ai_recommendations("food", "NYC", 5)
activities = get_ai_recommendations("activities", "NYC", 5)
nightlife = get_ai_recommendations("nightlife", "NYC", 5)  # New!
```

### Backward Compatibility
Old imports still work:
```python
from utils.ai_recommendations import (
    get_ai_food_recommendations,
    get_ai_activity_recommendations
)

food = get_ai_food_recommendations("NYC", 5)  # ✅ Still works!
```

## Code Reduction

- **Before**: 2 files, 158 lines of duplicated code
- **After**: 1 file, ~230 lines (includes 3 types + extensibility)
- **Saved**: ~80 lines, easier maintenance, unlimited new types

## Testing

```python
# Test basic functionality
from utils.ai_recommendations import get_ai_recommendations

# Should return list of restaurants
result = get_ai_recommendations("food", "San Francisco, CA", 3)
assert isinstance(result, list)
assert len(result) <= 3
assert all("name" in item and "address" in item for item in result)

# Should raise error for unknown type
try:
    get_ai_recommendations("invalid_type", "NYC", 5)
    assert False, "Should have raised ValueError"
except ValueError as e:
    assert "Unknown recommendation type" in str(e)
```

## Future Enhancements

Potential additions:
- **Caching layer**: Cache OpenAI responses to reduce API costs
- **Filtering**: Add price range, rating, distance filters
- **Localization**: Support multiple languages
- **Batch processing**: Generate multiple types in one call
- **User preferences**: Remember user's favorite types
- **Seasonal recommendations**: Adjust for time of year
