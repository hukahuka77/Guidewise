import { aiConfigured, getAiRecommendations, type EnrichedItem } from "./aiRecommendations";
import type { Sql } from "./db";
import { ServiceError } from "./guidebookService";
import { consumeAiQuota, refundAiQuota } from "./usage";

/** A recommendation in the shape the guidebook editor stores (`photo_reference` lives in `image_url`). */
export interface PlaceItem {
  name: string;
  address: string;
  description: string;
  image_url: string;
  place_id: string;
  driving_minutes: number | null;
}

export interface Recommendations {
  things_to_do: PlaceItem[];
  places_to_eat: PlaceItem[];
  /** Why nothing was added, when that is the case. */
  skipped?: "no_location" | "not_configured" | "quota" | "failed";
}

const RECOMMENDATION_TIMEOUT_MS = 30_000;

const toItem = (e: EnrichedItem): PlaceItem => ({
  name: e.name,
  address: e.address,
  description: e.description,
  image_url: e.photo_reference ?? "",
  place_id: e.place_id,
  driving_minutes: e.driving_minutes,
});

const withTimeout = <T,>(p: Promise<T>, ms: number, fallback: T) =>
  Promise.race([p, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);

/**
 * Pre-fill things to do and places to eat for an imported listing: one AI run covers both lists
 * (restaurants and activities, enriched with Google Places photos, addresses and drive times).
 * Never throws: the import still succeeds without recommendations.
 */
export async function recommendationsForListing(
  sql: Sql,
  userId: string,
  location: string,
  { alreadyCharged = false }: { alreadyCharged?: boolean } = {},
): Promise<Recommendations> {
  const empty: Recommendations = { things_to_do: [], places_to_eat: [] };
  if (!location.trim()) return { ...empty, skipped: "no_location" };
  if (!aiConfigured()) return { ...empty, skipped: "not_configured" };
  // When the import's AI run already paid for reading the listing, it covers these too, and stays spent
  const refund = () => (alreadyCharged ? Promise.resolve() : refundAiQuota(sql, userId));

  if (!alreadyCharged) {
    try {
      await consumeAiQuota(sql, userId);
    } catch (error) {
      if (error instanceof ServiceError && error.status === 403) return { ...empty, skipped: "quota" };
      console.error("import: could not check the AI allowance", error);
      return { ...empty, skipped: "failed" };
    }
  }

  try {
    const [food, activities] = await withTimeout(
      Promise.all([getAiRecommendations("food", location), getAiRecommendations("activities", location)]),
      RECOMMENDATION_TIMEOUT_MS,
      [[], []] as [EnrichedItem[], EnrichedItem[]],
    );
    if (food.length === 0 && activities.length === 0) {
      await refund();
      return { ...empty, skipped: "failed" };
    }
    return { things_to_do: activities.map(toItem), places_to_eat: food.map(toItem) };
  } catch (error) {
    console.error("import: recommendations failed", error);
    await refund();
    return { ...empty, skipped: "failed" };
  }
}
