import OpenAI from "openai";
import { jsonCompletion } from "./aiModel";
import { googleDistanceMatrix, googlePlacesDetails, googlePlacesTextSearch, isGoogleConfigured } from "./googlePlaces";
import { DEFAULT_AI_ITEMS } from "./rateLimit";

// AI recommendations for places to eat and things to do, enriched with Google Places data.

type Dict = Record<string, unknown>;
const asDict = (v: unknown): Dict => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Dict) : {});
const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

interface Config {
  systemPrompt: string;
  prompt: (address: string, n: number, key: string) => string;
  responseKeys: string[];
  defaultKey: string;
}

const NO_IMAGES = "Do NOT include any image URLs or keys for images.";

export const RECOMMENDATION_CONFIGS: Record<string, Config> = {
  food: {
    systemPrompt: "You are a helpful assistant that provides diverse, highly-rated restaurant and food recommendations.",
    prompt: (address, n, key) =>
      `Provide a JSON object with a key '${key}' containing a list of ${n} diverse, highly-rated restaurants or food spots near ${address}.
Each item must have 'name', 'address', and a brief 'description'.
The 'address' should be the real-world street address of the restaurant or place, as specific as possible (street, city, zip, etc).
The list should contain exactly ${n} items.
${NO_IMAGES}`,
    responseKeys: ["restaurants", "places_to_eat", "food"],
    defaultKey: "places_to_eat",
  },
  activities: {
    systemPrompt: "You are a helpful assistant that provides local activities and things to do in a strict JSON format.",
    prompt: (address, n, key) =>
      `For the vacation rental located at ${address},
please provide a list of local activities and things to do.
I need a JSON object with a key '${key}' containing an array of ${n} items.
Each item should be an object with three keys: 'name', 'address', and 'description'.
The 'address' should be the real-world street address of the activity or place, as specific as possible (street, city, zip, etc).
The list should contain exactly ${n} items.
${NO_IMAGES}`,
    responseKeys: ["activities", "things_to_do", "activityItems"],
    defaultKey: "activities",
  },
  nightlife: {
    systemPrompt: "You are a helpful assistant that provides nightlife and entertainment recommendations.",
    prompt: (address, n, key) =>
      `Provide a JSON object with a key '${key}' containing a list of ${n} popular nightlife spots, bars, clubs, or entertainment venues near ${address}.
Each item must have 'name', 'address', and a brief 'description'.
The 'address' should be the real-world street address, as specific as possible (street, city, zip, etc).
The list should contain exactly ${n} items.
${NO_IMAGES}`,
    responseKeys: ["nightlife", "entertainment", "bars", "venues"],
    defaultKey: "nightlife",
  },
};

export function isKnownType(type: unknown): type is string {
  return typeof type === "string" && Object.prototype.hasOwnProperty.call(RECOMMENDATION_CONFIGS, type);
}

export function extractItems(data: unknown, keys: string[]): unknown[] {
  if (Array.isArray(data)) return data;
  const d = asDict(data);
  for (const key of keys) if (Array.isArray(d[key])) return d[key] as unknown[];
  return [];
}

export interface EnrichedItem {
  name: string;
  address: string;
  description: string;
  place_id: string;
  photo_reference: string | null;
  driving_minutes: number | null;
}

async function enrichOne(item: unknown, location: string): Promise<EnrichedItem | null> {
  const it = asDict(item);
  const name = it.name;
  const itemAddress = it.address;
  if (typeof name !== "string" || !name || typeof itemAddress !== "string" || !itemAddress) return null;
  const description = typeof it.description === "string" ? it.description : "";

  const search = await googlePlacesTextSearch(`${name}, ${itemAddress}`, location);
  const place = asDict(asList(search.results)[0]);
  const placeId = place.place_id;
  if (typeof placeId !== "string" || !placeId) return null;

  const details = asDict((await googlePlacesDetails(placeId, "address")).result);
  const realAddress =
    (typeof details.formatted_address === "string" && details.formatted_address) ||
    (typeof place.formatted_address === "string" && place.formatted_address) ||
    itemAddress;
  const photos = asList(details.photos).length ? asList(details.photos) : asList(place.photos);
  const ref = asDict(photos[0]).photo_reference;

  let drivingMinutes: number | null = null;
  if (location && realAddress) drivingMinutes = (await googleDistanceMatrix(location, realAddress)).durationMinutes;

  return {
    name,
    address: realAddress,
    description,
    place_id: placeId,
    photo_reference: typeof ref === "string" && ref ? ref : null,
    driving_minutes: drivingMinutes,
  };
}

/** Enrich in parallel; an item that fails to enrich is skipped. */
export async function enrichWithGooglePlaces(items: unknown[], location: string): Promise<EnrichedItem[]> {
  const results = await Promise.all(
    items.map((item) =>
      enrichOne(item, location).catch((error) => {
        console.warn("Skipping recommendation that failed to enrich", error);
        return null;
      }),
    ),
  );
  return results.filter((r): r is EnrichedItem => r !== null);
}

/** Any failure while calling OpenAI/Places yields an empty list; an unknown type throws. */
export async function getAiRecommendations(type: string, address: string, numItems = DEFAULT_AI_ITEMS): Promise<EnrichedItem[]> {
  if (!isKnownType(type)) {
    throw new RangeError(
      `Unknown recommendation type: ${type}. Available types: ${Object.keys(RECOMMENDATION_CONFIGS).join(", ")}`,
    );
  }
  const config = RECOMMENDATION_CONFIGS[type];
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const content = await jsonCompletion(client, [
      { role: "system", content: config.systemPrompt },
      { role: "user", content: config.prompt(address, numItems, config.defaultKey) },
    ]);
    const parsed = JSON.parse(content ?? "null");
    const items = extractItems(parsed, config.responseKeys);
    if (items.length === 0) return [];
    return await enrichWithGooglePlaces(items, address);
  } catch (error) {
    console.error(`get_ai_recommendations(${type}) failed`, error);
    return [];
  }
}

/** Both OpenAI and Google must be configured; otherwise these routes answer 503. */
export const aiConfigured = () => Boolean(process.env.OPENAI_API_KEY) && isGoogleConfigured();
