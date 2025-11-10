"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import Spinner from "@/components/ui/spinner";
import { LIMITS } from "@/constants/limits";
import { supabase } from "@/lib/supabaseClient";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

import SidebarNav from "@/components/sections/SidebarNav";
import CreateGuidebookLayout from "@/components/sections/CreateGuidebookLayout";
import ArrivalSection from "@/components/sections/ArrivalSection";
import WifiSection from "@/components/sections/WifiSection";
import CheckinSection from "@/components/sections/CheckinSection";
import WelcomeSection from "@/components/sections/WelcomeSection";
import HouseManualList from "@/components/sections/HouseManualList";
import DynamicItemList, { DynamicItem } from "@/components/sections/DynamicItemList";
import PlacePickerModal from "@/components/places/PlacePickerModal";
import AddItemChoiceModal from "@/components/places/AddItemChoiceModal";
import RulesSection from "@/components/sections/RulesSection";
import CheckoutSection from "@/components/sections/CheckoutSection";
import { useGuidebookForm } from "@/hooks/useGuidebookForm";
import { useAIRecommendations } from "@/hooks/useAIRecommendations";
import { useImageUpload } from "@/hooks/useImageUpload";
import { useAuth } from "@/hooks/useAuth";
import { useSectionNavigation } from "@/hooks/useSectionNavigation";
import { buildGuidebookPayload } from "@/utils/guidebookPayload";
import { CREATE_SECTIONS_ORDER } from "@/config/sections";

type PlaceApiItem = Partial<DynamicItem> & { photo_reference?: string };

// Base URL for backend API, configured via environment. Example in .env.local:
// NEXT_PUBLIC_API_BASE_URL=http://localhost:5001
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL as string;
const BUCKET_NAME = process.env.NEXT_PUBLIC_SUPABASE_FOOD_ACTIVITIES_BUCKET as string;

export default function CreateGuidebookPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Use consolidated auth hook
  const { accessToken, authChecked } = useAuth({
    redirectTo: '/signup?next=/create',
    requireAuth: true,
  });

  // Use consolidated form hook
  const {
    formData,
    setFormData,
    coverImage,
    setCoverImage,
    previewUrl,
    setPreviewUrl,
    hostPhoto,
    setHostPhoto,
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
    ruleAutoEditIndex,
    setRuleAutoEditIndex,
    handleCoverImageSelect,
    handleHostPhotoSelect,
  } = useGuidebookForm({
    initialIncluded: [...CREATE_SECTIONS_ORDER],
    useDefaults: true,
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
    setCurrentSection,
    visitedSections,
    allowedSections,
    goToSection,
    goNext,
    canAdvance,
    hasReachedEnd,
  } = useSectionNavigation({
    sections: CREATE_SECTIONS_ORDER,
    mode: 'guided',
    requireLocation: true,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signupSuccess, setSignupSuccess] = useState<boolean>(false);

  // Handle signup success banner
  useEffect(() => {
    const created = searchParams?.get('created');
    if (created === '1' && typeof window !== 'undefined') {
      setSignupSuccess(true);
      const url = new URL(window.location.href);
      url.searchParams.delete('created');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      let coverImageUrl: string | undefined = undefined;
      let hostPhotoUrl: string | undefined = undefined;
      if (coverImage) {
        coverImageUrl = await uploadToStorage('covers', coverImage);
      }
      if (hostPhoto) {
        hostPhotoUrl = await uploadToStorage('hosts', hostPhoto);
      }

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
      {signupSuccess && (
        <div className="w-full bg-emerald-100 border-b border-emerald-300 text-emerald-800" role="alert">
          <div className="px-4 py-3 text-center">
            <strong className="font-bold">Success:</strong>
            <span className="block sm:inline"> Your account was created. Start creating your guidebook below.</span>
          </div>
        </div>
      )}

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
            disabled={isFetchingFood || !formData.location}
            onClick={async () => {
              const items = await fetchFoodRecommendations(formData.location, 5);
              setFoodItems(items);
            }}
          >
            {isFetchingFood ? (
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
            disabled={isFetchingActivities || !formData.location}
            onClick={async () => {
              const items = await fetchActivityRecommendations(formData.location, 5);
              setActivityItems(items);
            }}
          >
            {isFetchingActivities ? (
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
