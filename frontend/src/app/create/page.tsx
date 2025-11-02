"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import Spinner from "@/components/ui/spinner";
import { LIMITS } from "@/constants/limits";
import { supabase } from "@/lib/supabaseClient";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

import SidebarNav from "./SidebarNav";
import CreateGuidebookLayout from "./CreateGuidebookLayout";
import ArrivalSection from "./ArrivalSection";
import WifiSection from "./WifiSection";
import CheckinSection from "./CheckinSection";
import WelcomeSection from "./WelcomeSection";
import HouseManualList from "./HouseManualList";
import DynamicItemList, { DynamicItem } from "./DynamicItemList";
import PlacePickerModal from "@/components/places/PlacePickerModal";
import AddItemChoiceModal from "@/components/places/AddItemChoiceModal";
import RulesSection from "./RulesSection";
import CheckoutSection from "./CheckoutSection";

// Base URL for backend API, configured via environment. Example in .env.local:
// NEXT_PUBLIC_API_BASE_URL=http://localhost:5001
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
const BUCKET_NAME = process.env.NEXT_PUBLIC_SUPABASE_FOOD_ACTIVITIES_BUCKET;

export default function CreateGuidebookPage() {
  const router = useRouter();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const sectionsOrder = [
    "welcome",
    "checkin",
    "property",
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
    // Safety info for Welcome
    emergencyContact: '',
    fireExtinguisherLocation: '',
  });
  const [foodItems, setFoodItems] = useState<DynamicItem[]>([]);
  const [activityItems, setActivityItems] = useState<DynamicItem[]>([]);
  const [houseManualItems, setHouseManualItems] = useState<{ name: string; description: string }[]>([
    { name: "Trash Location", description: "Outdoor bins are on the left side of the house behind the wooden gate. Trash day is Tuesday evening." },
    { name: "Back Gate Code", description: "Use keypad on the back gate. Code: 1234 (press ✓ to unlock)." },
  ]);
  const [foodPickerOpen, setFoodPickerOpen] = useState(false);
  const [activityPickerOpen, setActivityPickerOpen] = useState(false);
  const [foodAddChoiceOpen, setFoodAddChoiceOpen] = useState(false);
  const [activityAddChoiceOpen, setActivityAddChoiceOpen] = useState(false);
  const [checkoutItems, setCheckoutItems] = useState<{ name: string; description: string; checked: boolean }[]>([
    { name: 'Take out trash', description: 'Please bag all trash and place it in the outside bin.', checked: true },
    { name: 'Dishes', description: 'Load and run the dishwasher (or hand wash any used dishes).', checked: true },
    { name: 'Lights & doors', description: 'Turn off lights, set thermostat to eco, and lock all doors/windows.', checked: true },
  ]);
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
  const [ruleAutoEditIndex, setRuleAutoEditIndex] = useState<number | null>(null);

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
    let mounted = true;
    (async () => {
      if (!supabase) {
        if (mounted) {
          setAccessToken(null);
          setAuthChecked(true);
          router.replace('/signup?next=/create');
        }
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (mounted) {
        setAccessToken(data.session?.access_token || null);
        setAuthChecked(true);
      }
    })();
    const subscription = supabase
      ? supabase.auth
          .onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
            setAccessToken(session?.access_token || null);
            setAuthChecked(true);
          })
          .data.subscription
      : { unsubscribe: () => {} };
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  // Redirect unauthenticated users to signup
  useEffect(() => {
    if (!authChecked) return;
    if (!accessToken) {
      router.replace('/signup?next=/create');
    }
  }, [authChecked, accessToken, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Helper: upload to Supabase Storage and return public URL
    const uploadToStorage = async (prefix: string, file: File): Promise<string | undefined> => {
      try {
        if (!supabase) return undefined;
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${prefix}/${Date.now()}-${safeName}`;
        const { error } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: true });
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
      if (coverImage) {
        coverImageUrl = await uploadToStorage('covers', coverImage);
      }
      if (hostPhoto) {
        hostPhotoUrl = await uploadToStorage('hosts', hostPhoto);
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
        safety_info: {
          emergency_contact: formData.emergencyContact,
          fire_extinguisher_location: formData.fireExtinguisherLocation,
        },
        rules: compiledRules,
        cover_image_url: coverImageUrl,
        // lists
        things_to_do: activityItems.map(i => ({ name: i.name, description: i.description, image_url: i.image_url || "", address: i.address || "" })),
        places_to_eat: foodItems.map(i => ({ name: i.name, description: i.description, image_url: i.image_url || "", address: i.address || "" })),
        checkout_info: checkoutItems.filter(i => i.checked).map(i => ({ name: i.name, description: i.description })),
        house_manual: houseManualItems.map(i => ({ name: i.name, description: i.description })),
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

      // Get the edit URL and preview URL from custom headers
      const liveUrlPath = response.headers.get('X-Guidebook-Url');
      const previewUrlPath = response.headers.get('X-Guidebook-Preview');
      if (liveUrlPath) {
        const fullLiveUrl = `${API_BASE}${liveUrlPath}`;
        sessionStorage.setItem('liveGuidebookUrl', fullLiveUrl);
      }
      if (previewUrlPath) {
        const fullPreviewUrl = `${API_BASE}${previewUrlPath}`;
        sessionStorage.setItem('previewGuidebookUrl', fullPreviewUrl);
      }

      // Read JSON with identifiers; do not create a blob now
      const json = await response.json();
      let newId: string | null = null;
      if (json && json.guidebook_id) {
        newId = String(json.guidebook_id);
        sessionStorage.setItem('guidebookId', newId);
      }

      // Render and store HTML snapshot so first live load is instant
      try {
        if (newId) {
          await fetch(`${API_BASE}/api/guidebooks/${newId}/publish`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            },
          });
        }
      } catch (e) {
        // Non-fatal—fallback to live render if publish snapshot fails
        console.warn('Snapshot publish failed (create):', e);
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

  // Navigation state for sidebar (guided flow)
  const [currentSection, setCurrentSection] = useState<string>("welcome");
  const [visitedSections, setVisitedSections] = useState<string[]>(["welcome"]);
  const goToSection = (section: string) => {
    // Only allow navigating to allowed sections (visited or next when eligible)
    // allowedSections is computed below but we can conservatively allow
    // - already visited, or
    // - immediate next if current can advance
    const idx = included.indexOf(currentSection);
    const next = idx >= 0 ? included[idx + 1] : undefined;
    const isAllowed = visitedSections.includes(section) || (section === next && (currentSection === "welcome" ? Boolean(formData.location && formData.location.trim()) : true));
    if (!isAllowed) return;
    if (!visitedSections.includes(section)) {
      setVisitedSections((prev) => [...prev, section]);
    }
    setCurrentSection(section);
  };

  // Ensure current section is always one of the included; if it becomes excluded or removed, jump to first included
  useEffect(() => {
    if (!included.includes(currentSection)) {
      setCurrentSection(included[0] || "welcome");
    }
  }, [included, currentSection]);

  // Ensure current is tracked as visited when it appears in included
  useEffect(() => {
    if (!visitedSections.includes(currentSection)) {
      setVisitedSections((prev) => [...prev, currentSection]);
    }
  }, [currentSection, visitedSections]);

  // Guided rules
  const currentIdx = included.indexOf(currentSection);
  const nextSection = currentIdx >= 0 ? included[currentIdx + 1] : undefined;
  const isWelcome = currentSection === "welcome";
  const canAdvanceFromCurrent = isWelcome ? Boolean(formData.location && formData.location.trim()) : true;
  const allRequiredVisited = included.every((s) => visitedSections.includes(s));

  // Allowed sections in sidebar:
  // - any previously visited
  // - current section
  // - next section if current can advance
  const allowedSections = Array.from(new Set([
    ...visitedSections.filter((s) => included.includes(s)),
    currentSection,
    ...(canAdvanceFromCurrent && nextSection ? [nextSection] : []),
  ]));

  const goNext = () => {
    if (!nextSection) return;
    if (!canAdvanceFromCurrent) return;
    setVisitedSections((prev) => (prev.includes(nextSection) ? prev : [...prev, nextSection]));
    setCurrentSection(nextSection);
  };

  // Once user has reached the end at least once, keep showing Publish everywhere
  const [hasReachedEnd, setHasReachedEnd] = useState<boolean>(false);
  useEffect(() => {
    if (allRequiredVisited && !hasReachedEnd) setHasReachedEnd(true);
  }, [allRequiredVisited, hasReachedEnd]);

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

  // While checking auth (or redirecting), show a centered spinner
  if (!authChecked || !accessToken) {
    return (
      <div className="w-full h-[60vh] flex items-center justify-center">
        <Spinner size={40} />
      </div>
    );
  }

  return (
    <div className="w-full">

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
            allowedSections={allowedSections}
            customEnabled={allRequiredVisited}
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
      {currentSection === "welcome" && (
        <WelcomeSection
          welcomeMessage={formData.welcomeMessage}
          location={formData.location}
          onChange={(id, value) => setFormData(f => ({ ...f, [id]: value }))}
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
            onChange={(id, value) => setFormData(f => ({ ...f, [id]: value }))}
          />
          <div className="mt-6">
            <WifiSection
              wifiNetwork={formData.wifiNetwork}
              wifiPassword={formData.wifiPassword}
              onChange={(id, value) => setFormData(f => ({ ...f, [id]: value }))}
            />
          </div>
        </>
      )}
      {currentSection === "property" && (
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
      )}
      
      {currentSection === "food" && (
        <div>
          <button
            type="button"
            className="mb-4 px-4 py-2 rounded bg-[oklch(0.6923_0.22_21.05)] text-white font-semibold shadow hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading || !formData.location}
            onClick={async () => {
              console.log('CLICKED PREPOPULATE FOOD, API_BASE:', API_BASE);
              setIsLoading(true);
              setError(null);
              try {
                const url = `${API_BASE}/api/ai-food`;
                console.log('FETCHING FROM:', url);
                const res = await fetch(url, {
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
                  setFoodItems(mapped);
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
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <Spinner size={18} />
                Loading…
              </span>
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
            title="Add Food Place"
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
            disabled={isLoading || !formData.location}
            onClick={async () => {
              console.log('CLICKED PREPOPULATE ACTIVITIES, API_BASE:', API_BASE);
              setIsLoading(true);
              setError(null);
              try {
                const url = `${API_BASE}/api/ai-activities`;
                console.log('FETCHING FROM:', url);
                const res = await fetch(url, {
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
                  setActivityItems(mapped);
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
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <Spinner size={18} />
                Loading…
              </span>
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
          onChange={(idx, field, value) => {
            setRules(rules =>
              rules.map((rule, i) =>
                i === idx ? { ...rule, [field]: field === 'checked' ? Boolean(value) : value } : rule
              )
            );
          }}
          onAdd={() =>
            setRules(prev => {
              const next = [...prev, { name: '', description: '', checked: false }];
              setRuleAutoEditIndex(next.length - 1);
              return next;
            })
          }
          autoEditIndex={ruleAutoEditIndex}
          onAutoEditHandled={() => setRuleAutoEditIndex(null)}
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
                  maxLength={LIMITS.customText}
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
              onClick={() =>
                setCustomSections(cs => {
                  const list = cs[currentSection] || [""];
                  if (list.length >= LIMITS.maxCustomTextBoxes) return cs;
                  return { ...cs, [currentSection]: [...list, ""] };
                })
              }
              disabled={(customSections[currentSection] || [""]).length >= LIMITS.maxCustomTextBoxes}
              className={`px-4 py-2 rounded bg-[oklch(0.6923_0.22_21.05)] text-white font-semibold shadow hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed`}
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
        />
      )}
      {currentSection === "arrival" && (
        <ArrivalSection checkInTime={formData.checkInTime} onChange={(id, value) => setFormData(f => ({ ...f, [id]: value }))} />
      )}
        {/* Next button (guided flow): sticky bottom-right within guidebook container */}
        <div className="sticky bottom-4 z-10 mt-8 flex justify-end">
          {hasReachedEnd ? (
            <Button
              type="button"
              className="px-10 py-3 bg-[oklch(0.6923_0.22_21.05)] text-white rounded-lg shadow hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={(e) => handleSubmit(e as unknown as React.FormEvent)}
              disabled={isLoading || !allRequiredVisited}
            >
              {isLoading ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner size={18} />
                  Processing…
                </span>
              ) : (
                "Publish"
              )}
            </Button>
          ) : nextSection ? (
            <Button
              type="button"
              className="px-6 py-3 bg-[oklch(0.6923_0.22_21.05)] text-white rounded-lg shadow hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={goNext}
              disabled={!canAdvanceFromCurrent}
            >
              Next
            </Button>
          ) : null}
        </div>
      </CreateGuidebookLayout>
    </div>
  );


}
