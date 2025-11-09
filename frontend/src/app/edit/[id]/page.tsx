"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

// Reuse create flow components
import SidebarNav from "@/app/create/SidebarNav";
import CreateGuidebookLayout from "@/app/create/CreateGuidebookLayout";
// import ArrivalSection from "@/app/create/ArrivalSection"; // not used on edit page
import WifiSection from "@/app/create/WifiSection";
import CheckinSection from "@/app/create/CheckinSection";
import WelcomeSection from "@/app/create/WelcomeSection";
import Spinner from "@/components/ui/spinner";
import HostInfoSection from "@/app/create/HostInfoSection";
import DynamicItemList, { DynamicItem } from "@/app/create/DynamicItemList";
import HouseManualList from "@/app/create/HouseManualList";
import RulesSection from "@/app/create/RulesSection";
import CheckoutSection from "@/app/create/CheckoutSection";
import AddItemChoiceModal from "@/components/places/AddItemChoiceModal";
import PlacePickerModal from "@/components/places/PlacePickerModal";
import { LIMITS } from "@/constants/limits";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL as string;
const BUCKET_NAME = process.env.NEXT_PUBLIC_SUPABASE_FOOD_ACTIVITIES_BUCKET as string;

// Type for API response items from places/recommendations
type PlaceApiItem = {
  name?: string;
  address?: string;
  description?: string;
  image_url?: string;
  photo_reference?: string;
};

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
  wifi?: {
    id?: number | string | null;
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

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const sectionsOrder = useMemo(() => (
    [
      "welcome",
      "checkin",
      "property",
      "hostinfo",
      "wifi",
      "food",
      "activities",
      "rules",
      "checkout",
    ] as const
  ), []);

  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [hostPhoto, setHostPhoto] = useState<File | null>(null);
  const [hostPhotoPreviewUrl, setHostPhotoPreviewUrl] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    propertyName: "",
    hostName: "",
    hostBio: "",
    hostContact: "",
    address_street: "",
    address_city_state: "",
    address_zip: "",
    access_info: "",
    welcomeMessage: "",
    location: "",
    parkingInfo: "",
    emergencyContact: "",
    fireExtinguisherLocation: "",
    wifiNetwork: "",
    wifiPassword: "",
    wifiNotes: "WiFi works best in the living room and kitchen. Please let us know if you have any issues.",
    checkInTime: "15:00",
    checkOutTime: "11:00",
  });
  const [foodItems, setFoodItems] = useState<DynamicItem[]>([]);
  const [activityItems, setActivityItems] = useState<DynamicItem[]>([]);
  const [checkoutItems, setCheckoutItems] = useState<{ name: string; description: string; checked: boolean }[]>([]);
  const [houseManualItems, setHouseManualItems] = useState<{ name: string; description: string }[]>([]);
  const [included, setIncluded] = useState<string[]>([...sectionsOrder]);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [customSections, setCustomSections] = useState<Record<string, string[]>>({});
  const [customTabsMeta, setCustomTabsMeta] = useState<Record<string, { icon: string; label: string }>>({});
  const [rules, setRules] = useState<{ name: string; description: string; checked: boolean }[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isFetchingFood, setIsFetchingFood] = useState(false);
  const [isFetchingActivities, setIsFetchingActivities] = useState(false);
  const [foodPickerOpen, setFoodPickerOpen] = useState(false);
  const [activityPickerOpen, setActivityPickerOpen] = useState(false);
  const [foodAddChoiceOpen, setFoodAddChoiceOpen] = useState(false);
  const [activityAddChoiceOpen, setActivityAddChoiceOpen] = useState(false);

  // Load token
  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (mounted) {
        setAccessToken(data.session?.access_token || null);
        setAuthReady(true);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setAccessToken(session?.access_token || null);
      setAuthReady(true);
    });
    return () => {
      mounted = false;
      sub.subscription?.unsubscribe();
    };
  }, []);

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
          wifiNetwork: data.wifi?.network || "",
          wifiPassword: data.wifi?.password || "",
          checkInTime: data.check_in_time || prev.checkInTime,
          checkOutTime: data.check_out_time || prev.checkOutTime,
        }));

        setIncluded(Array.isArray(data.included_tabs) && data.included_tabs.length ? data.included_tabs : [...sectionsOrder]);
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
  }, [guidebookId, accessToken, authReady, router, sectionsOrder]);

  const handleCoverImageSelect = (file: File | null) => {
    setCoverImage(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : previewUrl);
  };

  const handleHostPhotoSelect = (file: File | null) => {
    setHostPhoto(file);
    setHostPhotoPreviewUrl(file ? URL.createObjectURL(file) : hostPhotoPreviewUrl);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Helper: upload to Supabase Storage and return public URL
    const uploadToStorage = async (prefix: string, file: File): Promise<string | undefined> => {
      try {
        if (!supabase) return undefined;
        if (!BUCKET_NAME) return undefined;
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${prefix}/${Date.now()}-${safeName}`;
        const { error } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
        if (error) throw error;
        const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
        return data?.publicUrl || undefined;
      } catch (err) {
        console.error('Upload failed:', err);
        return undefined;
      }
    };

    try {
      let coverImageUrl: string | undefined = undefined;
      let hostPhotoUrl: string | undefined = undefined;
      if (coverImage) coverImageUrl = await uploadToStorage('covers', coverImage);
      if (hostPhoto) hostPhotoUrl = await uploadToStorage('hosts', hostPhoto);

      const compiledRules = rules
        .filter(r => r.checked)
        .map(r => (r.description ? `${r.name}: ${r.description}` : r.name))
        .filter(Boolean);

      // Build payload; only include optional images if user changed them
      const payload: Record<string, unknown> = {
        property_name: formData.propertyName,
        location: formData.location,
        welcome_message: formData.welcomeMessage,
        parking_info: formData.parkingInfo,
        host_name: formData.hostName,
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
        things_to_do: activityItems.map(i => ({ name: i.name, description: i.description, image_url: i.image_url || "", address: i.address || "" })),
        places_to_eat: foodItems.map(i => ({ name: i.name, description: i.description, image_url: i.image_url || "", address: i.address || "" })),
        checkout_info: checkoutItems.filter(i => i.checked).map(i => ({ name: i.name, description: i.description })),
        house_manual: houseManualItems.map(i => ({ name: i.name, description: i.description })),
        included_tabs: included,
        custom_sections: customSections,
        custom_tabs_meta: customTabsMeta,
      };
      if (coverImageUrl) payload.cover_image_url = coverImageUrl;
      if (hostPhotoUrl) payload.host_photo_url = hostPhotoUrl;

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

  const [currentSection, setCurrentSection] = useState<string>("welcome");
  const goToSection = (section: string) => setCurrentSection(section);

  useEffect(() => {
    if (!included.includes(currentSection)) {
      setCurrentSection(included[0] || "checkin");
    }
  }, [included, currentSection]);

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
  }, [included]);

  // Keep address_street synced with location text input
  useEffect(() => {
    setFormData(prev => {
      if (prev.address_street === prev.location) return prev;
      return { ...prev, address_street: prev.location };
    });
  }, [formData.location]);

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
          <CheckinSection
            accessInfo={formData.access_info}
            parkingInfo={formData.parkingInfo}
            checkInTime={formData.checkInTime}
            emergencyContact={formData.emergencyContact}
            fireExtinguisherLocation={formData.fireExtinguisherLocation}
            onChange={(id: string, value: string) => setFormData(f => ({ ...f, [id]: value }))}
          />
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
                setIsFetchingFood(true);
                setError(null);
                try {
                  const res = await fetch(`${API_BASE}/api/ai-food`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ address: formData.location, num_places_to_eat: 5 })
                  });
                  if (!res.ok) throw new Error("Failed to fetch food recommendations");
                  const data = await res.json();
                  let items: PlaceApiItem[] = [];
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
                    setFoodItems(items.map((item: PlaceApiItem) => ({
                      name: item.name || "",
                      address: item.address || "",
                      description: item.description || "",
                      image_url: item.photo_reference || item.image_url || ""
                    })));
                  } else {
                    setError("No recommendations found.");
                  }
                } catch (e: unknown) {
                  const msg = e instanceof Error ? e.message : "Failed to fetch recommendations";
                  setError(msg);
                } finally {
                  setIsFetchingFood(false);
                }
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
                setIsFetchingActivities(true);
                setError(null);
                try {
                  const res = await fetch(`${API_BASE}/api/ai-activities`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ address: formData.location, num_things_to_do: 5 })
                  });
                  if (!res.ok) throw new Error("Failed to fetch activities recommendations");
                  const data = await res.json();
                  let items: PlaceApiItem[] = [];
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
                    setActivityItems(items.map((item: PlaceApiItem) => ({
                      name: item.name || "",
                      address: item.address || "",
                      description: item.description || "",
                      image_url: item.photo_reference || item.image_url || ""
                    })));
                  } else {
                    setError("No recommendations found.");
                  }
                } catch (e: unknown) {
                  const msg = e instanceof Error ? e.message : "Failed to fetch recommendations";
                  setError(msg);
                } finally {
                  setIsFetchingActivities(false);
                }
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
