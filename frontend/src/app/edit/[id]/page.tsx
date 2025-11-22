"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

// Shared components
import SidebarNav from "@/components/sections/SidebarNav";
import CreateGuidebookLayout from "@/components/sections/CreateGuidebookLayout";
import CheckinSection from "@/components/sections/CheckinSection";
import WelcomeSection from "@/components/sections/WelcomeSection";
import Spinner from "@/components/ui/spinner";
import DynamicItemList, { DynamicItem } from "@/components/sections/DynamicItemList";
import HouseManualList from "@/components/sections/HouseManualList";
import RulesSection from "@/components/sections/RulesSection";
import CheckoutSection from "@/components/sections/CheckoutSection";
import CustomSection, { CustomItem } from "@/components/sections/CustomSection";
import AddItemChoiceModal from "@/components/places/AddItemChoiceModal";
import PlacePickerModal from "@/components/places/PlacePickerModal";
import EditTutorial from "@/components/ui/EditTutorial";
import { LIMITS } from "@/constants/limits";
import { useGuidebookForm } from "@/hooks/useGuidebookForm";
import { useAIRecommendations } from "@/hooks/useAIRecommendations";
import { useImageUpload } from "@/hooks/useImageUpload";
import { useAuth } from "@/hooks/useAuth";
import { useSectionNavigation } from "@/hooks/useSectionNavigation";
import { buildGuidebookPayload } from "@/utils/guidebookPayload";
import { EDIT_SECTIONS_ORDER } from "@/config/sections";
import ConfirmModal from "@/components/ui/ConfirmModal";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL as string;
const BUCKET_NAME = process.env.NEXT_PUBLIC_SUPABASE_FOOD_ACTIVITIES_BUCKET as string;
const HOUSE_MEDIA_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_USER_VIDEOS_BUCKET as string;


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
  custom_sections?: Record<string, (string | CustomItem)[]> | null;
  custom_tabs_meta?: Record<string, { icon: string; label: string }> | null;
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
  house_manual?: { name?: string | null; description?: string | null; media_url?: string | null; media_type?: string | null }[] | null;
  safety_info?: { emergency_contact?: string | null; fire_extinguisher_location?: string | null } | null;
};

export default function EditGuidebookPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const guidebookId = params?.id as string;
  const isNewGuidebook = searchParams.get('new') === 'true';

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

  // Use image upload hooks
  const { uploadToStorage } = useImageUpload({
    bucketName: BUCKET_NAME,
  });
  const { uploadToStorage: uploadHouseMedia, deleteFromStorage: deleteHouseMedia } = useImageUpload({
    bucketName: HOUSE_MEDIA_BUCKET || BUCKET_NAME,
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
  const [pendingHouseMediaIndex, setPendingHouseMediaIndex] = useState<number | null>(null);
  const [showHouseMediaConfirm, setShowHouseMediaConfirm] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  // Check if this is first-time visiting edit page (skip on mobile)
  useEffect(() => {
    if (!initialLoading) {
      const isMobile = window.innerWidth < 768; // Skip tutorial on mobile/tablet
      const hasSeenTutorial = localStorage.getItem('hasSeenEditTutorial') === 'true';
      if (!hasSeenTutorial && !isMobile) {
        setShowTutorial(true);
      }
    }
  }, [initialLoading]);

  // Hide tutorial if window is resized to mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768 && showTutorial) {
        setShowTutorial(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [showTutorial]);

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

        const loadedIncluded = Array.isArray(data.included_tabs) && data.included_tabs.length ? data.included_tabs : [...EDIT_SECTIONS_ORDER];
        setIncluded(loadedIncluded);

        // Compute excluded sections as all sections not in included
        const allSections = [...EDIT_SECTIONS_ORDER];
        const loadedExcluded = allSections.filter(section => !loadedIncluded.includes(section));
        setExcluded(loadedExcluded);

        // Convert legacy string[] custom sections to CustomItem[]
        const loadedCustomSections: Record<string, CustomItem[]> = {};
        if (data.custom_sections) {
          Object.entries(data.custom_sections).forEach(([key, items]) => {
            loadedCustomSections[key] = items.map(item =>
              typeof item === 'string' ? { type: 'text', content: item } : item
            );
          });
        }
        setCustomSections(loadedCustomSections);
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
        setHouseManualItems((data.house_manual || []).map(i => ({
          name: i.name || "",
          description: i.description || "",
          mediaUrl: i.media_url || "",
          mediaType: i.media_type === 'video' ? 'video' : i.media_type === 'image' ? 'image' : undefined,
        })));
        setRules((data.rules || []).map((rule: any) => {
          // Handle new JSON format: {name: string, description: string}
          if (typeof rule === 'object' && rule.name !== undefined) {
            return { name: rule.name || "", description: rule.description || "", checked: true };
          }
          // Handle legacy string format: "name: description"
          if (typeof rule === 'string') {
            return { name: rule.split(":")[0] || rule, description: rule.includes(":") ? rule.split(":").slice(1).join(":").trim() : "", checked: true };
          }
          return { name: "", description: "", checked: true };
        }));
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
  }, [guidebookId, accessToken, authReady, router, setActivityItems, setCheckoutItems, setCustomSections, setCustomTabsMeta, setExcluded, setFoodItems, setFormData, setHostPhotoPreviewUrl, setHouseManualItems, setIncluded, setPreviewUrl, setRules]);

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

      // Redirect based on whether this is a new guidebook or an edit
      if (isNewGuidebook) {
        router.push(`/select-template/${guidebookId}`);
      } else {
        router.push('/dashboard?updated=true');
      }
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "An unexpected error occurred. Please try again.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Allow viewing both included and excluded sections
  // Removed automatic redirect to first included section

  useEffect(() => {
    setCustomSections(prev => {
      let changed = false;
      const next = { ...prev } as Record<string, CustomItem[]>;
      for (const key of included) {
        if (key.startsWith("custom_") && !(key in next)) {
          next[key] = [{ type: 'text', content: '' }];
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
      {/* Tutorial overlay */}
      {showTutorial && (
        <EditTutorial
          onComplete={() => {
            setShowTutorial(false);
            localStorage.setItem('hasSeenEditTutorial', 'true');
          }}
        />
      )}

      <CreateGuidebookLayout
        sidebar={
          <div data-tutorial="sidebar">
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
              customTabsMeta={customTabsMeta}
            />
          </div>
        }
      >
        <div data-tutorial="content-area">
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
              wifiNetwork={formData.wifiNetwork}
              wifiPassword={formData.wifiPassword}
              onChange={(id: string, value: string) => setFormData(f => ({ ...f, [id]: value }))}
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
                  onMediaSelect={async (idx, file) => {
                    if (!file) {
                      setHouseManualItems(items =>
                        items.map((it, i) =>
                          i === idx ? { ...it, mediaUrl: undefined, mediaType: undefined } : it
                        )
                      );
                      return;
                    }

                    try {
                      const url = await uploadHouseMedia('guide', file);
                      if (!url) return;
                      const isVideo = file.type && file.type.startsWith('video/');
                      const mediaType = isVideo ? 'video' : 'image';
                      setHouseManualItems(items =>
                        items.map((it, i) =>
                          i === idx ? { ...it, mediaUrl: url, mediaType } : it
                        )
                      );
                    } catch (e) {
                      console.error('Failed to upload house manual media:', e);
                      setError(prev => prev || 'Failed to upload media. Please try a smaller file or different format.');
                    }
                  }}
                  onRemoveMedia={(idx) => {
                    setPendingHouseMediaIndex(idx);
                    setShowHouseMediaConfirm(true);
                  }}
                />
              </div>
            </>
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
              onDelete={(idx: number) => setRules(rules => rules.filter((_, i) => i !== idx))}
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
              onDelete={(idx: number) => setCheckoutItems(items => items.filter((_, i) => i !== idx))}
            />
          )}

          {/* Custom sections */}
          {currentSection.startsWith("custom_") && (
            <CustomSection
              sectionKey={currentSection}
              icon={customTabsMeta[currentSection]?.icon || "📝"}
              label={customTabsMeta[currentSection]?.label || "Custom Section"}
              items={customSections[currentSection] || []}
              onChange={(items) => setCustomSections(prev => ({ ...prev, [currentSection]: items }))}
              onLabelChange={(newLabel) => setCustomTabsMeta(prev => ({
                ...prev,
                [currentSection]: {
                  icon: prev[currentSection]?.icon || "📝",
                  label: newLabel
                }
              }))}
              onMediaSelect={async (idx, file) => {
                if (!file) return;
                const mediaType = file.type.startsWith("video/") ? "video" : "image";
                const uploadedUrl = await uploadHouseMedia('guide', file);
                if (uploadedUrl) {
                  setCustomSections(prev => {
                    const items = [...(prev[currentSection] || [])];
                    const item = items[idx];
                    if (item && item.type === 'manual') {
                      items[idx] = { ...item, mediaUrl: uploadedUrl, mediaType };
                    }
                    return { ...prev, [currentSection]: items };
                  });
                }
              }}
              onRemoveMedia={(idx) => {
                setCustomSections(prev => {
                  const items = [...(prev[currentSection] || [])];
                  const item = items[idx];
                  if (item && item.type === 'manual' && item.mediaUrl) {
                    deleteHouseMedia(item.mediaUrl);
                    items[idx] = { ...item, mediaUrl: undefined, mediaType: undefined };
                  }
                  return { ...prev, [currentSection]: items };
                });
              }}
            />
          )}

          {/* Publish button at bottom right */}
          <div className="flex justify-end mt-8">
            <Button
              type="button"
              data-tutorial="publish-button"
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
      </CreateGuidebookLayout>

      <ConfirmModal
        open={showHouseMediaConfirm}
        title="Remove media?"
        description={"This will permanently remove the attached image or video from this House Manual item and delete it from storage."}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        destructive
        onCancel={() => {
          setShowHouseMediaConfirm(false);
          setPendingHouseMediaIndex(null);
        }}
        onConfirm={async () => {
          if (pendingHouseMediaIndex == null) {
            setShowHouseMediaConfirm(false);
            return;
          }
          const current = houseManualItems[pendingHouseMediaIndex];
          const url = current?.mediaUrl;
          if (url) {
            try {
              await deleteHouseMedia(url);
            } catch (e) {
              console.error('Failed to delete house manual media:', e);
            }
          }
          setHouseManualItems(items =>
            items.map((it, i) =>
              i === pendingHouseMediaIndex ? { ...it, mediaUrl: undefined, mediaType: undefined } : it
            )
          );
          setShowHouseMediaConfirm(false);
          setPendingHouseMediaIndex(null);
        }}
      />
    </div>
  );
}
