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
import HostInfoSection from "@/app/create/HostInfoSection";
import PropertySection from "@/app/create/PropertySection";
import DynamicItemList, { DynamicItem } from "@/app/create/DynamicItemList";
import RulesSection from "@/app/create/RulesSection";
import CheckoutSection from "@/app/create/CheckoutSection";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

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
  };
  wifi?: {
    id?: number | string | null;
    network?: string | null;
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
};

export default function EditGuidebookPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const guidebookId = params?.id as string;

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const sectionsOrder = useMemo(() => (
    [
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
    wifiNetwork: "",
    wifiPassword: "",
    wifiNotes: "WiFi works best in the living room and kitchen. Please let us know if you have any issues.",
    checkInTime: "15:00",
    checkOutTime: "11:00",
  });
  const [foodItems, setFoodItems] = useState<DynamicItem[]>([]);
  const [activityItems, setActivityItems] = useState<DynamicItem[]>([]);
  const [checkoutItems, setCheckoutItems] = useState<{ name: string; description: string; checked: boolean }[]>([]);
  const [included, setIncluded] = useState<string[]>([...sectionsOrder]);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [customSections, setCustomSections] = useState<Record<string, string[]>>({});
  const [customTabsMeta, setCustomTabsMeta] = useState<Record<string, { icon: string; label: string }>>({});
  const [rules, setRules] = useState<{ name: string; description: string; checked: boolean }[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

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
          wifiNetwork: data.wifi?.network || "",
          // keep wifiPassword empty unless user sets it
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
        setRules((data.rules || []).map((text: string) => ({ name: text.split(":")[0] || text, description: text.includes(":") ? text.split(":").slice(1).join(":").trim() : "", checked: true })));
        if (data.cover_image_url) setPreviewUrl(data.cover_image_url);
      } catch (e: unknown) {
        console.error(e);
        const msg = e instanceof Error ? e.message : "Failed to load guidebook";
        setError(msg);
      } finally {
        setIsLoading(false);
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

    const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });

    try {
      let coverImageUrl: string | undefined = undefined;
      let hostPhotoUrl: string | undefined = undefined;
      if (coverImage) coverImageUrl = await toBase64(coverImage);
      if (hostPhoto) hostPhotoUrl = await toBase64(hostPhoto);

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
        rules: compiledRules,
        things_to_do: activityItems.map(i => ({ name: i.name, description: i.description, image_url: i.image_url || "", address: i.address || "" })),
        places_to_eat: foodItems.map(i => ({ name: i.name, description: i.description, image_url: i.image_url || "", address: i.address || "" })),
        checkout_info: checkoutItems.filter(i => i.checked).map(i => ({ name: i.name, description: i.description })),
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

      // After update, go to live view
      window.location.href = `${API_BASE}/guidebook/${guidebookId}`;
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "An unexpected error occurred. Please try again.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const [currentSection, setCurrentSection] = useState<string>("checkin");
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
            {isLoading ? "Updating…" : "Publish Changes"}
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
        {currentSection === "checkin" && (
          <CheckinSection
            welcomeMessage={formData.welcomeMessage}
            location={formData.location}
            accessInfo={formData.access_info}
            parkingInfo={formData.parkingInfo}
            checkInTime={formData.checkInTime}
            onChange={(id, value) => setFormData(f => ({ ...f, [id]: value }))}
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
          <PropertySection
            propertyName={formData.propertyName}
            onChange={(id, value) => setFormData(f => ({ ...f, [id]: value }))}
            onCoverImageChange={handleCoverImageSelect}
            coverPreviewUrl={previewUrl}
          />
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
              disabled={isLoading || !formData.location}
              onClick={async () => {
                setIsLoading(true);
                setError(null);
                try {
                  const res = await fetch(`${API_BASE}/api/ai-food`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ address: formData.location, num_places_to_eat: 5 })
                  });
                  if (!res.ok) throw new Error("Failed to fetch food recommendations");
                  const data = await res.json();
                  let items: Partial<DynamicItem>[] = [];
                  if (Array.isArray(data)) {
                    items = data;
                  } else if (Array.isArray(data.restaurants)) {
                    items = data.restaurants;
                  } else if (Array.isArray(data.places_to_eat)) {
                    items = data.places_to_eat;
                  } else if (Array.isArray(data.food)) {
                    items = data.food;
                  }
                  if (items.length > 0) {
                    setFoodItems(items.map((item: Partial<DynamicItem>) => ({
                      name: item.name || "",
                      address: item.address || "",
                      description: item.description || "",
                      image_url: item.image_url || ""
                    })));
                  } else {
                    setError("No recommendations found.");
                  }
                } catch (e: unknown) {
                  const msg = e instanceof Error ? e.message : "Failed to fetch recommendations";
                  setError(msg);
                } finally {
                  setIsLoading(false);
                }
              }}
            >
              {isLoading ? "Loading..." : "Prepopulate with AI"}
            </button>
            <DynamicItemList
              items={foodItems}
              label="Nearby Food"
              onChange={(idx, field, value) => {
                setFoodItems(items => items.map((item, i) => i === idx ? { ...item, [field]: value } : item));
              }}
              onAdd={() => setFoodItems(items => [...items, { name: '', address: '', description: '' }])}
              onDelete={idx => setFoodItems(items => items.filter((_, i) => i !== idx))}
            />
          </div>
        )}
        {currentSection === "activities" && (
          <div>
            <button
              type="button"
              className="mb-4 px-4 py-2 rounded bg-[oklch(0.6923_0.22_21.05)] text-white font-semibold shadow hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading || !formData.location}
              onClick={async () => {
                setIsLoading(true);
                setError(null);
                try {
                  const res = await fetch(`${API_BASE}/api/ai-activities`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ address: formData.location, num_things_to_do: 5 })
                  });
                  if (!res.ok) throw new Error("Failed to fetch activities recommendations");
                  const data = await res.json();
                  let items: Partial<DynamicItem>[] = [];
                  if (Array.isArray(data)) {
                    items = data;
                  } else if (Array.isArray(data.activities)) {
                    items = data.activities;
                  } else if (Array.isArray(data.things_to_do)) {
                    items = data.things_to_do;
                  } else if (Array.isArray(data.activityItems)) {
                    items = data.activityItems;
                  }
                  if (items.length > 0) {
                    setActivityItems(items.map((item: Partial<DynamicItem>) => ({
                      name: item.name || "",
                      address: item.address || "",
                      description: item.description || "",
                      image_url: item.image_url || ""
                    })));
                  } else {
                    setError("No recommendations found.");
                  }
                } catch (e: unknown) {
                  const msg = e instanceof Error ? e.message : "Failed to fetch recommendations";
                  setError(msg);
                } finally {
                  setIsLoading(false);
                }
              }}
            >
              {isLoading ? "Loading..." : "Prepopulate with AI"}
            </button>
            <DynamicItemList
              items={activityItems}
              label="Things To Do"
              onChange={(idx, field, value) => {
                setActivityItems(items => items.map((item, i) => i === idx ? { ...item, [field]: value } : item));
              }}
              onAdd={() => setActivityItems(items => [...items, { name: '', address: '', description: '' }])}
              onDelete={idx => setActivityItems(items => items.filter((_, i) => i !== idx))}
            />
          </div>
        )}
        {currentSection === "rules" && (
          <RulesSection
            rules={rules}
            onChange={(idx, field, value) => {
              setRules(rules =>
                rules.map((rule, i) =>
                  i === idx ? { ...rule, [field]: field === 'checked' ? Boolean(value) : String(value) } : rule
                )
              );
            }}
            onAdd={() => setRules([...rules, { name: '', description: '', checked: false }])}
            onDelete={(idx) => setRules(rules => rules.filter((_, i) => i !== idx))}
          />
        )}
        {currentSection === "checkout" && (
          <CheckoutSection
            checkoutTime={formData.checkOutTime}
            items={checkoutItems}
            onTimeChange={(value: string) => setFormData(f => ({ ...f, checkOutTime: value }))}
            onChange={(idx, field, value) => {
              setCheckoutItems(items => items.map((item, i) =>
                i === idx ? { ...item, [field]: field === 'checked' ? Boolean(value) : String(value) } : item
              ));
            }}
            onAdd={() => setCheckoutItems(items => [...items, { name: '', description: '', checked: false }])}
            onDelete={(idx) => setCheckoutItems(items => items.filter((_, i) => i !== idx))}
          />
        )}
      </CreateGuidebookLayout>
    </div>
  );
}
