"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

// Shared components
import SidebarNav from "@/components/sections/SidebarNav";
import CreateGuidebookLayout from "@/components/sections/CreateGuidebookLayout";
import WifiSection from "@/components/sections/WifiSection";
import CheckinSection from "@/components/sections/CheckinSection";
import WelcomeSection from "@/components/sections/WelcomeSection";
import Spinner from "@/components/ui/spinner";
import HostInfoSection from "@/components/sections/HostInfoSection";
import DynamicItemList, { DynamicItem } from "@/components/sections/DynamicItemList";
import HouseManualList from "@/components/sections/HouseManualList";
import RulesSection from "@/components/sections/RulesSection";
import CheckoutSection from "@/components/sections/CheckoutSection";
import AddItemChoiceModal from "@/components/places/AddItemChoiceModal";
import PlacePickerModal from "@/components/places/PlacePickerModal";
import { LIMITS } from "@/constants/limits";
import { useGuidebookForm } from "@/hooks/useGuidebookForm";
import { useAIRecommendations } from "@/hooks/useAIRecommendations";
import { useImageUpload } from "@/hooks/useImageUpload";
import { useAuth } from "@/hooks/useAuth";
import { useSectionNavigation } from "@/hooks/useSectionNavigation";
import { buildGuidebookPayload } from "@/utils/guidebookPayload";
import { EDIT_SECTIONS_ORDER } from "@/config/sections";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL as string;
const BUCKET_NAME = process.env.NEXT_PUBLIC_SUPABASE_FOOD_ACTIVITIES_BUCKET as string;


type GuidebookDetail = {
  id: number | string;
  template_key?: string | null;
  property?: {
    id?: number | string | null;
    name?: string | null;
    address_street?: string | null;
    address_city_state?: string | null;
    address_zip?: string | null;
  };
  host?: {
    id?: number | string | null;
    name?: string | null;
    bio?: string | null;
    contact?: string | null;
    photo_url?: string | null;
  };
  wifi_json?: {
    network?: string | null;
    password?: string | null;
  };
  included_tabs?: string[] | null;
  custom_sections?: Record<string, string[]> | null;
  custom_tabs_meta?: Record<string, { icon: string; label: string }>| null;
  things_to_do?: DynamicItem[] | null;
  places_to_eat?: DynamicItem[] | null;
  rules?: string[] | null;
  created_time?: string | null;
  last_modified_time?: string | null;
  check_in_time?: string | null;
  check_out_time?: string | null;
  access_info?: string | null;
  welcome_message?: string | null;
  parking_info?: string | null;
  cover_image_url?: string | null;
  checkout_info?: { name: string; description: string }[] | null;
  house_manual?: { name: string; description: string }[] | null;
  safety_info?: { emergency_contact?: string | null; fire_extinguisher_location?: string | null } | null;
};

export default function EditGuidebookPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const guidebookId = params?.id as string;

  // Use consolidated auth hook
  const { accessToken, authChecked: authReady } = useAuth({
    requireAuth: false, // Edit doesn't redirect immediately, loads data first
  });

  // Use consolidated form hook
  const {
    formData,
    setFormData,
    coverImage,
    previewUrl,
    setPreviewUrl,
    hostPhoto,
    hostPhotoPreviewUrl,
    setHostPhotoPreviewUrl,
    foodItems,
    setFoodItems,
    activityItems,
    setActivityItems,
    houseManualItems,
    setHouseManualItems,
    checkoutItems,
    setCheckoutItems,
    rules,
    setRules,
    included,
    setIncluded,
    excluded,
    setExcluded,
    customSections,
    setCustomSections,
    customTabsMeta,
    setCustomTabsMeta,
    foodPickerOpen,
    setFoodPickerOpen,
    activityPickerOpen,
    setActivityPickerOpen,
    foodAddChoiceOpen,
    setFoodAddChoiceOpen,
    activityAddChoiceOpen,
    setActivityAddChoiceOpen,
    handleCoverImageSelect,
    handleHostPhotoSelect,
  } = useGuidebookForm({
    initialIncluded: [...EDIT_SECTIONS_ORDER],
    useDefaults: false, // Edit mode loads data, doesn't use defaults
  });

  // Use AI recommendations hook
  const {
    isFetchingFood,
    isFetchingActivities,
    fetchFoodRecommendations,
    fetchActivityRecommendations,
  } = useAIRecommendations({
    apiBase: API_BASE,
    onError: (msg) => setError(msg),
  });

  // Use image upload hook
  const { uploadToStorage } = useImageUpload({
    bucketName: BUCKET_NAME,
  });

  // Use section navigation hook
  const {
    currentSection,
    setCurrentSection: goToSection,
  } = useSectionNavigation({
    sections: EDIT_SECTIONS_ORDER,
    mode: 'open', // Edit mode allows all sections
  });

  const [isLoading, setIsLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch existing guidebook details
  useEffect(() => {
    if (!guidebookId || !authReady) return;
    if (!accessToken) {
      router.push("/login");
      return;
    }
    (async () => {
      try {
        setIsLoading(true);
        setInitialLoading(true);
        const res = await fetch(`${API_BASE}/api/guidebooks/${guidebookId}`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        });
        // 401 shouldn't occur because we verified accessToken above; still handle just in case
        if (res.status === 401) { router.push("/login"); return; }
        if (!res.ok) throw new Error(`Failed to load guidebook (${res.status})`);
        const data: GuidebookDetail = await res.json();

        // Map payload into form state
        setFormData(prev => ({
          ...prev,
          propertyName: data.property?.name || "",
          hostName: data.host?.name || "",
          hostBio: data.host?.bio || "",
          hostContact: data.host?.contact || "",
          address_street: data.property?.address_street || "",
          address_city_state: data.property?.address_city_state || "",
          address_zip: data.property?.address_zip || "",
          access_info: data.access_info || "",
          welcomeMessage: data.welcome_message || "",
          parkingInfo: data.parking_info || "",
          location: data.property?.address_street || "",
          emergencyContact: data.safety_info?.emergency_contact || "",
          fireExtinguisherLocation: data.safety_info?.fire_extinguisher_location || "",
          wifiNetwork: data.wifi_json?.network || "",
          wifiPassword: data.wifi_json?.password || "",
          checkInTime: data.check_in_time || prev.checkInTime,
          checkOutTime: data.check_out_time || prev.checkOutTime,
        }));

        setIncluded(Array.isArray(data.included_tabs) && data.included_tabs.length ? data.included_tabs : [...EDIT_SECTIONS_ORDER]);
        setCustomSections(data.custom_sections || {});
        setCustomTabsMeta(data.custom_tabs_meta || {});
        setFoodItems((data.places_to_eat || []).map((i: Partial<DynamicItem>) => ({
          name: i.name || "",
          address: i.address || "",
          description: i.description || "",
          image_url: i.image_url || "",
        })));
        setActivityItems((data.things_to_do || []).map((i: Partial<DynamicItem>) => ({
          name: i.name || "",
          address: i.address || "",
          description: i.description || "",
          image_url: i.image_url || "",
        })));
        setCheckoutItems((data.checkout_info || []).map(i => ({ ...i, checked: true })));
        setHouseManualItems((data.house_manual || []).map(i => ({ name: i.name, description: i.description })));
        setRules((data.rules || []).map((text: string) => ({ name: text.split(":")[0] || text, description: text.includes(":") ? text.split(":").slice(1).join(":").trim() : "", checked: true })));
        if (data.cover_image_url) setPreviewUrl(data.cover_image_url);
        if (data.host?.photo_url) setHostPhotoPreviewUrl(data.host.photo_url);
      } catch (e: unknown) {
        console.error(e);
        const msg = e instanceof Error ? e.message : "Failed to load guidebook";
        setError(msg);
      } finally {
        setIsLoading(false);
        setInitialLoading(false);
      }
    })();
  }, [guidebookId, accessToken, authReady, router, setActivityItems, setCheckoutItems, setCustomSections, setCustomTabsMeta, setFoodItems, setFormData, setHostPhotoPreviewUrl, setHouseManualItems, setIncluded, setPreviewUrl, setRules]);

  // Image handlers are now provided by useGuidebookForm hook

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      let coverImageUrl: string | undefined = undefined;
      let hostPhotoUrl: string | undefined = undefined;
      if (coverImage) coverImageUrl = await uploadToStorage('covers', coverImage);
      if (hostPhoto) hostPhotoUrl = await uploadToStorage('hosts', hostPhoto);

      // Build payload using utility function
      const payload = buildGuidebookPayload({
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
      });

      const res = await fetch(`${API_BASE}/api/guidebooks/${guidebookId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) throw new Error(`Update failed (${res.status})`);

      // After update, render and store the HTML snapshot so next view is instant
      try {
        await fetch(`${API_BASE}/api/guidebooks/${guidebookId}/publish`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
        });
      } catch (e) {
        console.warn('Snapshot publish failed (edit):', e);
      }

      // Then go to live view
      window.location.href = `${API_BASE}/guidebook/${guidebookId}`;
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "An unexpected error occurred. Please try again.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!included.includes(currentSection)) {
      goToSection(included[0] || "checkin");
    }
  }, [included, currentSection, goToSection]);

  useEffect(() => {
    setCustomSections(prev => {
      let changed = false;
      const next = { ...prev } as Record<string, string[]>;
      for (const key of included) {
        if (key.startsWith("custom_") && !(key in next)) {
          next[key] = [""];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [included, setCustomSections]);

  // Keep address_street synced with location text input
  useEffect(() => {
    setFormData(prev => {
      if (prev.address_street === prev.location) return prev;
      return { ...prev, address_street: prev.location };
    });
  }, [formData.location, setFormData]);

  if (initialLoading) {
    return (
      <div className="w-full min-h-[60vh] flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-700">
          <Spinner size={22} colorClass="text-[oklch(0.6923_0.22_21.05)]" />
          <span>Loading…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="w-full sticky top-0 z-20 bg-transparent">
        <div className="max-w-[1800px] mx-auto px-4 py-2 flex items-center justify-end">
          <Button
            type="button"
            className="px-10 py-4 bg-[oklch(0.6923_0.22_21.05)] text-white font-semibold rounded-lg shadow-lg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed text-lg md:text-xl"
            onClick={(e) => handleSubmit(e as unknown as React.FormEvent)}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <Spinner size={18} />
                Updating…
              </span>
            ) : (
              "Publish Changes"
            )}
          </Button>
        </div>
      </div>

      <CreateGuidebookLayout
        sidebar={
          <SidebarNav
            currentSection={currentSection}
            onSectionChange={goToSection}
            included={included}
            excluded={excluded}
            onUpdate={(inc, exc) => {
              setIncluded(inc);
              setExcluded(exc);
            }}
            onCustomMetaChange={(meta) => setCustomTabsMeta(meta)}
          />
        }
      >
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
            <strong className="font-bold">Error:</strong>
            <span className="block sm:inline"> {error}</span>
          </div>
        )}
        {currentSection === "welcome" && (
          <WelcomeSection
            welcomeMessage={formData.welcomeMessage}
            location={formData.location}
            onChange={(id: string, value: string) => setFormData(f => ({ ...f, [id]: value }))}
            propertyName={formData.propertyName}
            onCoverImageChange={handleCoverImageSelect}
            coverPreviewUrl={previewUrl}
            hostName={formData.hostName}
            hostBio={formData.hostBio}
            hostContact={formData.hostContact}
            onHostPhotoChange={handleHostPhotoSelect}
            hostPhotoPreviewUrl={hostPhotoPreviewUrl}
          />
        )}
        {currentSection === "checkin" && (
          <>
            <CheckinSection
              accessInfo={formData.access_info}
              parkingInfo={formData.parkingInfo}
              checkInTime={formData.checkInTime}
              emergencyContact={formData.emergencyContact}
              fireExtinguisherLocation={formData.fireExtinguisherLocation}
              onChange={(id: string, value: string) => setFormData(f => ({ ...f, [id]: value }))}
            />
            <div className="mt-6">
              <WifiSection
                wifiNetwork={formData.wifiNetwork}
                wifiPassword={formData.wifiPassword}
                onChange={(id: string, value: string) => setFormData(f => ({ ...f, [id]: value }))}
              />
            </div>
          </>
        )}
        {currentSection === "hostinfo" && (
          <HostInfoSection
            name={formData.hostName}
            bio={formData.hostBio}
            contact={formData.hostContact}
            onChange={(id, value) => setFormData(f => ({ ...f, [id]: value }))}
            onHostPhotoChange={handleHostPhotoSelect}
            hostPhotoPreviewUrl={hostPhotoPreviewUrl}
          />
        )}
        {currentSection === "property" && (
          <>
            <div className="mt-0">
              <HouseManualList
                items={houseManualItems}
                onChange={(idx, field, value) => {
                  setHouseManualItems(items => items.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
                }}
                onAdd={() => setHouseManualItems(items => [...items, { name: "", description: "" }])}
                onDelete={(idx) => setHouseManualItems(items => items.filter((_, i) => i !== idx))}
              />
            </div>
          </>
        )}
        {currentSection === "wifi" && (
          <WifiSection
            wifiNetwork={formData.wifiNetwork}
            wifiPassword={formData.wifiPassword}
            onChange={(id, value) => setFormData(f => ({ ...f, [id]: value }))}
          />
        )}
        {currentSection === "food" && (
          <div>
            <button
              type="button"
              className="mb-4 px-4 py-2 rounded bg-[oklch(0.6923_0.22_21.05)] text-white font-semibold shadow hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isFetchingFood || !formData.location}
              onClick={async () => {
                const items = await fetchFoodRecommendations(formData.location, 5);
                setFoodItems(items);
              }}
            >
              {isFetchingFood ? (
                <span className="inline-flex items-center gap-2"><Spinner size={16} /> Prepopulate with AI…</span>
              ) : (
                "Prepopulate with AI"
              )}
            </button>
            <DynamicItemList
              items={foodItems}
              label="Nearby Food"
              onChange={(idx, field, value) => {
                setFoodItems(items => items.map((item, i) => i === idx ? { ...item, [field]: value } : item));
              }}
              onAdd={() => setFoodAddChoiceOpen(true)}
              onDelete={idx => setFoodItems(items => items.filter((_, i) => i !== idx))}
            />
            <AddItemChoiceModal
              open={foodAddChoiceOpen}
              onClose={() => setFoodAddChoiceOpen(false)}
              title="Add Food"
              onGoogle={() => setFoodPickerOpen(true)}
              onManual={() =>
                setFoodItems(items =>
                  items.length >= LIMITS.maxFoodActivityItems ? items : [...items, { name: '', address: '', description: '' }]
                )
              }
            />
            <PlacePickerModal
              open={foodPickerOpen}
              onClose={() => setFoodPickerOpen(false)}
              apiBase={API_BASE}
              near={formData.location}
              title="Add Food"
              onSelect={(item) => {
                setFoodItems(items =>
                  items.length >= LIMITS.maxFoodActivityItems
                    ? items
                    : [...items, { name: item.name, address: item.address, description: item.description || '', image_url: item.image_url || '' }]
                );
              }}
            />
          </div>
        )}
        {currentSection === "activities" && (
          <div>
            <button
              type="button"
              className="mb-4 px-4 py-2 rounded bg-[oklch(0.6923_0.22_21.05)] text-white font-semibold shadow hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isFetchingActivities || !formData.location}
              onClick={async () => {
                const items = await fetchActivityRecommendations(formData.location, 5);
                setActivityItems(items);
              }}
            >
              {isFetchingActivities ? (
                <span className="inline-flex items-center gap-2"><Spinner size={16} /> Prepopulate with AI…</span>
              ) : (
                "Prepopulate with AI"
              )}
            </button>
            <DynamicItemList
              items={activityItems}
              label="Nearby Activities"
              onChange={(idx, field, value) => {
                setActivityItems(items => items.map((item, i) => i === idx ? { ...item, [field]: value } : item));
              }}
              onAdd={() => setActivityAddChoiceOpen(true)}
              onDelete={idx => setActivityItems(items => items.filter((_, i) => i !== idx))}
            />
            <AddItemChoiceModal
              open={activityAddChoiceOpen}
              onClose={() => setActivityAddChoiceOpen(false)}
              title="Add Activity"
              onGoogle={() => setActivityPickerOpen(true)}
              onManual={() =>
                setActivityItems(items =>
                  items.length >= LIMITS.maxFoodActivityItems ? items : [...items, { name: '', address: '', description: '' }]
                )
              }
            />
            <PlacePickerModal
              open={activityPickerOpen}
              onClose={() => setActivityPickerOpen(false)}
              apiBase={API_BASE}
              near={formData.location}
              title="Add Activity"
              onSelect={(item) => {
                setActivityItems(items =>
                  items.length >= LIMITS.maxFoodActivityItems
                    ? items
                    : [...items, { name: item.name, address: item.address, description: item.description || '', image_url: item.image_url || '' }]
                );
              }}
            />
          </div>
        )}
        {currentSection === "rules" && (
          <RulesSection
            rules={rules}
            onChange={(idx: number, field, value) => {
              setRules(rules =>
                rules.map((rule, i) =>
                  i === idx ? { ...rule, [field]: field === 'checked' ? Boolean(value) : String(value) } : rule
                )
              );
            }}
            onAdd={() => setRules([...rules, { name: '', description: '', checked: false }])}
          />
        )}
        {currentSection === "checkout" && (
          <CheckoutSection
            checkoutTime={formData.checkOutTime}
            items={checkoutItems}
            onTimeChange={(value: string) => setFormData(f => ({ ...f, checkOutTime: value }))}
            onChange={(idx: number, field, value) => {
              setCheckoutItems(items => items.map((item, i) =>
                i === idx ? { ...item, [field]: field === 'checked' ? Boolean(value) : String(value) } : item
              ));
            }}
            onAdd={() => setCheckoutItems(items => [...items, { name: '', description: '', checked: false }])}
          />
        )}
      </CreateGuidebookLayout>
    </div>
  );
}
