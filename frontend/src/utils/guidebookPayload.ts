import type { DynamicItem } from '@/components/sections/DynamicItemList';
import type { FormData, RuleItem, CheckoutItem, HouseManualItem } from '@/hooks/useGuidebookForm';
import type { CustomItem } from '@/components/sections/CustomSection';

export interface BuildPayloadOptions {
  formData: FormData;
  foodItems: DynamicItem[];
  activityItems: DynamicItem[];
  rules: RuleItem[];
  houseManualItems: HouseManualItem[];
  checkoutItems: CheckoutItem[];
  customSections: Record<string, (string | CustomItem)[]>;
  customTabsMeta: Record<string, { icon: string; label: string }>;
  included: string[];
  coverImageUrl?: string;
  hostPhotoUrl?: string;
}

/**
 * Compiles rules from state (sends only checked rules as strings)
 */
export function compileRules(rules: RuleItem[]): string[] {
  return rules
    .filter(r => r.checked)
    .map(r => (r.description ? `${r.name}: ${r.description}` : r.name))
    .filter(Boolean);
}

/**
 * Maps dynamic items to API format
 */
export function mapDynamicItems(items: DynamicItem[]) {
  return items.map(i => ({
    name: i.name,
    description: i.description,
    image_url: i.image_url || "",
    address: i.address || ""
  }));
}

/**
 * Maps checkout items to API format (only checked items)
 */
export function mapCheckoutItems(items: CheckoutItem[]) {
  return items
    .filter(i => i.checked)
    .map(i => ({
      name: i.name,
      description: i.description
    }));
}

/**
 * Maps house manual items to API format
 */
export function mapHouseManualItems(items: HouseManualItem[]) {
  return items.map(i => ({
    name: i.name,
    description: i.description,
    media_url: i.mediaUrl || "",
    media_type: i.mediaType || undefined,
  }));
}

/**
 * Builds the complete guidebook payload for API submission
 * Used by both create and edit flows
 */
export function buildGuidebookPayload(options: BuildPayloadOptions): Record<string, unknown> {
  const {
    formData,
    foodItems,
    activityItems,
    rules,
    houseManualItems,
    checkoutItems,
    customSections,
    customTabsMeta,
    included,
    coverImageUrl,
    hostPhotoUrl,
  } = options;

  const compiledRules = compileRules(rules);

  const payload: Record<string, unknown> = {
    property_name: formData.propertyName,
    host_name: formData.hostName,
    location: formData.location,
    welcome_message: formData.welcomeMessage,
    parking_info: formData.parkingInfo,
    host_bio: formData.hostBio,
    host_contact: formData.hostContact,
    address_street: formData.address_street,
    address_city_state: formData.address_city_state,
    address_zip: formData.address_zip,
    access_info: formData.access_info,
    wifi_network: formData.wifiNetwork,
    wifi_password: formData.wifiPassword || undefined,
    check_in_time: formData.checkInTime,
    check_out_time: formData.checkOutTime,
    safety_info: {
      emergency_contact: formData.emergencyContact,
      fire_extinguisher_location: formData.fireExtinguisherLocation,
    },
    rules: compiledRules,
    things_to_do: mapDynamicItems(activityItems),
    places_to_eat: mapDynamicItems(foodItems),
    checkout_info: mapCheckoutItems(checkoutItems),
    house_manual: mapHouseManualItems(houseManualItems),
    included_tabs: included,
    custom_sections: customSections,
    custom_tabs_meta: customTabsMeta,
  };

  // Only include image URLs if provided
  if (coverImageUrl) {
    payload.cover_image_url = coverImageUrl;
  }
  if (hostPhotoUrl) {
    payload.host_photo_url = hostPhotoUrl;
  }

  return payload;
}
