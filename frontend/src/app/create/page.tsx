"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

import SidebarNav from "./SidebarNav";
import CreateGuidebookLayout from "./CreateGuidebookLayout";
import ArrivalSection from "./ArrivalSection";
import WifiSection from "./WifiSection";
import CheckinSection from "./CheckinSection";
import HostInfoSection from "./HostInfoSection";
import PropertySection from "./PropertySection";
import DynamicItemList, { DynamicItem } from "./DynamicItemList";
import RulesSection from "./RulesSection";
import CheckoutSection from "./CheckoutSection";

// Base URL for backend API, configured via environment. Example in .env.local:
// NEXT_PUBLIC_API_BASE_URL=http://localhost:5001
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

export default function CreateGuidebookPage() {
  const router = useRouter();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const sectionsOrder = [
    "checkin",
    "property",
    "hostinfo",
    "wifi",
    "food",
    "activities",
    "rules",
    "checkout",
  ] as const;
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [hostPhoto, setHostPhoto] = useState<File | null>(null);
  const [hostPhotoPreviewUrl, setHostPhotoPreviewUrl] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    propertyName: '',
    hostName: '', // Placeholder only
    hostBio: '',
    hostContact: '', // Placeholder only
    address: '',
    address_street: '',
    address_city_state: '',
    address_zip: '',
    access_info: '',
    welcomeMessage: '',
    location: '', // Only required field, leave blank
    parkingInfo: '',
    wifiNetwork: '', // Placeholder only
    wifiPassword: '', // Placeholder only
    wifiNotes: 'WiFi works best in the living room and kitchen. Please let us know if you have any issues.',
    checkInTime: '15:00',
    checkOutTime: '11:00',
  });
  const [foodItems, setFoodItems] = useState<DynamicItem[]>([]);
  const [activityItems, setActivityItems] = useState<DynamicItem[]>([]);
  const [checkoutItems, setCheckoutItems] = useState<{ name: string; description: string; checked: boolean }[]>([]);
  // Sidebar state: included order and excluded list
  const [included, setIncluded] = useState<string[]>([...sectionsOrder]);
  const [excluded, setExcluded] = useState<string[]>([]);
  // Custom tabs: map tab key -> array of text boxes
  const [customSections, setCustomSections] = useState<Record<string, string[]>>({});
  const [customTabsMeta, setCustomTabsMeta] = useState<Record<string, { icon: string; label: string }>>({});
  const [rules, setRules] = useState<{ name: string; description: string; checked: boolean }[]>([
    { name: 'No Smoking', description: 'Smoking is not allowed inside the house or on the balcony.', checked: true },
    { name: 'No Parties or Events', description: 'Parties and events are not allowed on the property.', checked: true },
    { name: 'No Pets', description: 'Pets are not allowed unless approved in advance.', checked: true },
    { name: 'Quiet Hours', description: 'Please keep noise to a minimum after 10pm to respect our neighbors.', checked: true },
    { name: 'No Unregistered Guests', description: 'Only guests included in the reservation are allowed to stay.', checked: true },
    { name: 'Remove Shoes Indoors', description: 'Please remove your shoes when entering the house.', checked: true }
  ]);

  // Note: controlled inputs update state inline where needed; remove unused generic handler

  const handleCoverImageSelect = (file: File | null) => {
    setCoverImage(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  };

  const handleHostPhotoSelect = (file: File | null) => {
    setHostPhoto(file);
    setHostPhotoPreviewUrl(file ? URL.createObjectURL(file) : null);
  };

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load Supabase session Access Token for authenticated backend calls
  useEffect(() => {
    if (!supabase) return; // auth disabled; allow anonymous creation
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (mounted) setAccessToken(data.session?.access_token || null);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setAccessToken(session?.access_token || null);
    });
    return () => {
      mounted = false;
      sub.subscription?.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Helper function to convert file to Base64
    const toBase64 = (file: File): Promise<string> =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
      });

    try {
      let coverImageUrl: string | undefined = undefined;
      let hostPhotoUrl: string | undefined = undefined;
      if (coverImage) {
        coverImageUrl = await toBase64(coverImage);
      }
      if (hostPhoto) {
        hostPhotoUrl = await toBase64(hostPhoto);
      }

      // Compile rules from state (send only checked rules as strings)
      const compiledRules = rules
        .filter(r => r.checked)
        .map(r => (r.description ? `${r.name}: ${r.description}` : r.name))
        .filter(Boolean);

      // Prepare the JSON payload with snake_case keys for the backend
      const payload = {
        property_name: formData.propertyName,
        host_name: formData.hostName,
        // additional non-persisted or informational fields
        location: formData.location,
        welcome_message: formData.welcomeMessage,
        parking_info: formData.parkingInfo,
        host_bio: formData.hostBio,
        host_contact: formData.hostContact,
        host_photo_url: hostPhotoUrl,
        address_street: formData.address_street,
        address_city_state: formData.address_city_state,
        address_zip: formData.address_zip,
        access_info: formData.access_info,
        wifi_network: formData.wifiNetwork,
        wifi_password: formData.wifiPassword,
        check_in_time: formData.checkInTime,
        check_out_time: formData.checkOutTime,
        rules: compiledRules,
        cover_image_url: coverImageUrl,
        // lists
        things_to_do: activityItems.map(i => ({ name: i.name, description: i.description, image_url: i.image_url || "", address: i.address || "" })),
        places_to_eat: foodItems.map(i => ({ name: i.name, description: i.description, image_url: i.image_url || "", address: i.address || "" })),
        checkout_info: checkoutItems.filter(i => i.checked).map(i => ({ name: i.name, description: i.description })),
        included_tabs: included,
        custom_sections: customSections,
        custom_tabs_meta: customTabsMeta,
      };

      const response = await fetch(`${API_BASE}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Get the live URL from the custom header
      const liveUrlPath = response.headers.get('X-Guidebook-Url');
      if (liveUrlPath) {
        const fullLiveUrl = `${API_BASE}${liveUrlPath}`;
        sessionStorage.setItem('liveGuidebookUrl', fullLiveUrl);
      }

      // Read JSON with identifiers; do not create a blob now
      const json = await response.json();
      if (json && json.guidebook_id) {
        sessionStorage.setItem('guidebookId', String(json.guidebook_id));
      }

      router.push('/success');

    } catch (err: unknown) {
      console.error('Failed to generate guidebook:', err);
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Navigation state for sidebar (free navigation among included)
  const [currentSection, setCurrentSection] = useState<string>("checkin");
  const goToSection = (section: string) => setCurrentSection(section);

  // Ensure current section is always one of the included; if it becomes excluded or removed, jump to first included
  useEffect(() => {
    if (!included.includes(currentSection)) {
      setCurrentSection(included[0] || "checkin");
    }
  }, [included, currentSection]);

  // Initialize newly added custom tabs with a default single textbox
  useEffect(() => {
    setCustomSections(prev => {
      let changed = false;
      const next = { ...prev };
      for (const key of included) {
        if (key.startsWith("custom_") && !(key in next)) {
          next[key] = [""]; // default single textbox
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [included]);

  // Keep backend address fields in sync with the selected location so the live view shows the user's address
  useEffect(() => {
    setFormData(prev => {
      if (prev.address_street === prev.location) return prev;
      return { ...prev, address_street: prev.location };
    });
  }, [formData.location]);

  return (
    <div className="w-full">
      {/* Top-right Publish button above the guidebook container (bigger, tighter to top-right) */}
      <div className="w-full sticky top-0 z-20 bg-transparent">
        <div className="max-w-[1800px] mx-auto px-4 py-2 flex items-center justify-end">
          <Button
            type="button"
            className="px-10 py-4 bg-[oklch(0.6923_0.22_21.05)] text-white font-semibold rounded-lg shadow-lg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed text-lg md:text-xl"
            onClick={(e) => handleSubmit(e as unknown as React.FormEvent)}
            disabled={isLoading}
          >
            {isLoading ? "Processing…" : "Publish"}
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
      {/* Section rendering based on sidebar navigation */}
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
        <WifiSection wifiNetwork={formData.wifiNetwork} wifiPassword={formData.wifiPassword} onChange={(id, value) => setFormData(f => ({ ...f, [id]: value }))} />
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
          let items = [];
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
          let items = [];
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
      label="Nearby Activities"
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
                i === idx ? { ...rule, [field]: field === 'checked' ? Boolean(value) : value } : rule
              )
            );
          }}
          onAdd={() => setRules([...rules, { name: '', description: '', checked: false }])}
          onDelete={idx => setRules(rules => rules.filter((_, i) => i !== idx))}
        />
      )}
      {currentSection.startsWith("custom_") && (
        <div className="space-y-4">
          <div className="text-xl font-semibold">Custom Section</div>
          <div className="space-y-3">
            {(customSections[currentSection] || [""]).map((val, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <textarea
                  className="w-full min-h-[90px] border rounded px-3 py-2"
                  placeholder={`Text box ${idx + 1}`}
                  value={val}
                  onChange={(e) =>
                    setCustomSections(cs => ({
                      ...cs,
                      [currentSection]: cs[currentSection].map((v, i) => (i === idx ? e.target.value : v)),
                    }))
                  }
                />
                <button
                  type="button"
                  className="shrink-0 px-3 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                  onClick={() =>
                    setCustomSections(cs => ({
                      ...cs,
                      [currentSection]: cs[currentSection].filter((_, i) => i !== idx),
                    }))
                  }
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <div>
            <button
              type="button"
              className="px-4 py-2 rounded bg-[oklch(0.6923_0.22_21.05)] text-white font-semibold shadow hover:opacity-90"
              onClick={() =>
                setCustomSections(cs => ({
                  ...cs,
                  [currentSection]: [...(cs[currentSection] || [""]), ""],
                }))
              }
            >
              Add text box
            </button>
          </div>
        </div>
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
      {currentSection === "arrival" && (
        <ArrivalSection checkInTime={formData.checkInTime} onChange={(id, value) => setFormData(f => ({ ...f, [id]: value }))} />
      )}
      </CreateGuidebookLayout>

      {/* Bottom centered Publish button */}
      <div className="w-full mt-10 mb-16 flex items-center justify-center">
        <Button
          type="button"
          className="px-10 py-4 bg-[oklch(0.6923_0.22_21.05)] text-white font-semibold rounded-lg shadow-lg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed text-lg md:text-xl"
          onClick={(e) => handleSubmit(e as unknown as React.FormEvent)}
          disabled={isLoading}
        >
          {isLoading ? "Processing…" : "Publish"}
        </Button>
      </div>
    </div>
  );


}
