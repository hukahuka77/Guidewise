import { useState } from 'react';
import type { DynamicItem } from '@/components/sections/DynamicItemList';

type PlaceApiItem = Partial<DynamicItem> & { photo_reference?: string };

interface UseAIRecommendationsOptions {
  apiBase: string;
  onError?: (message: string) => void;
}

export function useAIRecommendations(options: UseAIRecommendationsOptions) {
  const { apiBase, onError } = options;

  const [isFetchingFood, setIsFetchingFood] = useState(false);
  const [isFetchingActivities, setIsFetchingActivities] = useState(false);

  /**
   * Fetch food recommendations from AI
   */
  const fetchFoodRecommendations = async (
    location: string,
    count: number = 5
  ): Promise<DynamicItem[]> => {
    console.log('CLICKED PREPOPULATE FOOD, API_BASE:', apiBase);
    setIsFetchingFood(true);

    try {
      const url = `${apiBase}/api/ai-food`;
      console.log('FETCHING FROM:', url);

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: location, num_places_to_eat: count })
      });

      if (!res.ok) {
        throw new Error("Failed to fetch food recommendations");
      }

      const data = await res.json();
      let items: PlaceApiItem[] = [];

      // Handle different API response formats
      if (Array.isArray(data)) {
        items = data as PlaceApiItem[];
      } else if (Array.isArray(data.restaurants)) {
        items = data.restaurants as PlaceApiItem[];
      } else if (Array.isArray(data.places_to_eat)) {
        items = data.places_to_eat as PlaceApiItem[];
      } else if (Array.isArray(data.food)) {
        items = data.food as PlaceApiItem[];
      }

      if (items.length > 0) {
        console.log('RAW FOOD API RESPONSE:', items);

        const mapped = items.map((item: Partial<DynamicItem>) => {
          const photoRef = (item as { photo_reference?: string }).photo_reference || item.image_url || "";
          console.log('Food Item:', item.name, 'photo_reference:', (item as { photo_reference?: string }).photo_reference, 'image_url:', item.image_url, 'Final:', photoRef);

          return {
            name: item.name || "",
            address: item.address || "",
            description: item.description || "",
            image_url: photoRef
          };
        });

        console.log('MAPPED FOOD ITEMS:', mapped);
        return mapped;
      } else {
        const errorMsg = "No food recommendations found.";
        if (onError) onError(errorMsg);
        return [];
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to fetch food recommendations";
      if (onError) onError(msg);
      return [];
    } finally {
      setIsFetchingFood(false);
    }
  };

  /**
   * Fetch activity recommendations from AI
   */
  const fetchActivityRecommendations = async (
    location: string,
    count: number = 5
  ): Promise<DynamicItem[]> => {
    console.log('CLICKED PREPOPULATE ACTIVITIES, API_BASE:', apiBase);
    setIsFetchingActivities(true);

    try {
      const url = `${apiBase}/api/ai-activities`;
      console.log('FETCHING FROM:', url);

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: location, num_things_to_do: count })
      });

      if (!res.ok) {
        throw new Error("Failed to fetch activities recommendations");
      }

      const data = await res.json();
      let items: PlaceApiItem[] = [];

      // Handle different API response formats
      if (Array.isArray(data)) {
        items = data as PlaceApiItem[];
      } else if (Array.isArray(data.activities)) {
        items = data.activities as PlaceApiItem[];
      } else if (Array.isArray(data.things_to_do)) {
        items = data.things_to_do as PlaceApiItem[];
      } else if (Array.isArray(data.activityItems)) {
        items = data.activityItems as PlaceApiItem[];
      }

      if (items.length > 0) {
        console.log('RAW API RESPONSE:', items);

        const mapped = items.map((item: Partial<DynamicItem>) => {
          const photoRef = (item as { photo_reference?: string }).photo_reference || item.image_url || "";
          console.log('Item:', item.name, 'photo_reference:', (item as { photo_reference?: string }).photo_reference, 'image_url:', item.image_url, 'Final:', photoRef);

          return {
            name: item.name || "",
            address: item.address || "",
            description: item.description || "",
            image_url: photoRef
          };
        });

        console.log('MAPPED ITEMS:', mapped);
        return mapped;
      } else {
        const errorMsg = "No activity recommendations found.";
        if (onError) onError(errorMsg);
        return [];
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to fetch activity recommendations";
      if (onError) onError(msg);
      return [];
    } finally {
      setIsFetchingActivities(false);
    }
  };

  return {
    isFetchingFood,
    isFetchingActivities,
    fetchFoodRecommendations,
    fetchActivityRecommendations,
  };
}
