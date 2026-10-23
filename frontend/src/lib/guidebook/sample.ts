import type { GuidebookRow } from "./types";

/** Cover photo used by new guidebooks without one (same placeholder the product already uses). */
const COVER = "https://hojncqasasvvrhdmwwhv.supabase.co/storage/v1/object/public/my_images/home_placeholder.jpg";

/**
 * A made-up guidebook shown in the phone on the start screen before the host has created one, so they can see
 * what guests will get. It goes through the same templates as every real guidebook.
 */
export function sampleGuidebook(templateKey = "template_signature"): GuidebookRow {
  return {
    id: "sample",
    template_key: templateKey,
    included_tabs: ["welcome", "checkin", "property", "food", "activities", "rules", "checkout"],
    check_in_time: "15:00",
    check_out_time: "11:00",
    access_info: "Your door code arrives by message the morning you check in.",
    parking_info: "Two spots in the driveway. Street parking is free after 6pm.",
    welcome_info:
      "Welcome to Willow Cottage! We are so happy you are here.\nEverything you need for your stay is in this guidebook: how to get in, how things work, and our favorite places nearby.",
    cover_image_url: COVER,
    safety_info: { emergency_contact: "In an emergency call 911", fire_extinguisher_location: "Under the kitchen sink" },
    things_to_do: [
      { name: "Riverside Trail", address: "Willow Park", description: "A flat, shaded walk along the river. Perfect for a morning coffee stroll.", image_url: "", driving_minutes: 6 },
      { name: "Saturday Farmers Market", address: "Main Street", description: "Local produce, fresh bread and live music every Saturday morning.", image_url: "", driving_minutes: 10 },
    ],
    places_to_eat: [
      { name: "The Corner Bakery", address: "12 Oak Avenue", description: "Pastries and strong coffee. Try the cardamom bun.", image_url: "", driving_minutes: 4 },
      { name: "Lantern Kitchen", address: "88 River Road", description: "Relaxed dinner spot with a great patio.", image_url: "", driving_minutes: 8 },
    ],
    checkout_info: [
      { name: "Start the dishwasher", description: "Load any used dishes and run a quick cycle." },
      { name: "Lock up", description: "Close the windows and make sure the front door is locked behind you." },
    ],
    house_manual: [
      { name: "Heating and cooling", description: "The thermostat is in the hallway. Please set it to eco when you leave." },
      { name: "Trash and recycling", description: "Bins are at the side of the house. Pickup is on Wednesday mornings." },
    ],
    rules_json: [
      { name: "Quiet hours", description: "Please keep noise down between 10pm and 8am." },
      { name: "No smoking", description: "Smoking is not permitted inside or on the porch." },
    ],
    wifi_json: { network: "WillowCottage", password: "welcome2024" },
    custom_sections: {},
    custom_tabs_meta: {},
    created_time: null,
    last_modified_time: "2026-01-01T00:00:00+00:00",
    user_id: null,
    public_slug: null,
    property: { id: 0, name: "Willow Cottage", address_street: "1 Willow Lane", address_city_state: "Anytown, USA", address_zip: null },
    host: { id: 0, name: "Alex", bio: "Your host. Message me anytime if you need anything.", contact: null, host_image_url: null },
  } as GuidebookRow;
}
