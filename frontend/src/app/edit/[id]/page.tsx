"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ExternalLink, EyeOff, Loader2, Lock, Search, Smartphone, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/editor/primitives";

// Shared components
import SidebarNav, { SECTION_META, insertInOrder } from "@/components/sections/SidebarNav";
import CreateGuidebookLayout from "@/components/sections/CreateGuidebookLayout";
import CheckinSection from "@/components/sections/CheckinSection";
import WelcomeSection from "@/components/sections/WelcomeSection";
import Spinner from "@/components/ui/spinner";
import DynamicItemList, { DynamicItem } from "@/components/sections/DynamicItemList";
import HouseManualList from "@/components/sections/HouseManualList";
import RulesSection from "@/components/sections/RulesSection";
import CheckoutSection from "@/components/sections/CheckoutSection";
import CustomSection, { CustomItem } from "@/components/sections/CustomSection";
import PlacePickerModal from "@/components/places/PlacePickerModal";
import EditTutorial from "@/components/ui/EditTutorial";
import PhonePreview from "@/components/custom/PhonePreview";
import { useMedia } from "@/components/home/useMedia";
import { LIMITS } from "@/constants/limits";
import { useGuidebookForm } from "@/hooks/useGuidebookForm";
import { useAIRecommendations } from "@/hooks/useAIRecommendations";
import { useImageUpload } from "@/hooks/useImageUpload";
import { useAuth } from "@/hooks/useAuth";
import { usePremiumStyles } from "@/hooks/usePremiumStyles";
import { isPremiumStyle, PREMIUM_STYLE_MESSAGE, PREMIUM_STYLE_PLAN } from "@/lib/guidebook/styles";
import { offerUpgrade, throwApiError, UpgradeRequiredError } from "@/lib/upgrade";
import { useSectionNavigation } from "@/hooks/useSectionNavigation";
import { buildGuidebookPayload } from "@/utils/guidebookPayload";
import { EDIT_SECTIONS_ORDER } from "@/config/sections";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useDialog } from "@/hooks/useDialog";
import { showDialog } from "@/lib/dialog";
import { loginPath } from "@/lib/nextPath";

const BUCKET_NAME = process.env.NEXT_PUBLIC_SUPABASE_FOOD_ACTIVITIES_BUCKET as string;
const HOUSE_MEDIA_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_USER_VIDEOS_BUCKET as string;
// Waits before trying a failed autosave again; after the last one the editor asks the host instead
const AUTOSAVE_RETRY_MS = [2000, 5000, 15000];

/** A save the server answered with an error status. */
class SaveError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}


type GuidebookDetail = {
  id: number | string;
  template_key?: string | null;
  public_slug?: string | null;
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
  rules?: (string | { name?: string | null; description?: string | null })[] | null;
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
  const { accessToken, authChecked: authReady, isGuest } = useAuth({
    requireAuth: false, // Edit doesn't redirect immediately, loads data first
  });
  const premiumStyles = usePremiumStyles(accessToken, isGuest);
  // Supabase refreshes the token in the background: requests read the latest one from here, so a refresh
  // never re-runs the load (which would reset the form to the saved copy and lose unsaved edits)
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;
  const signedIn = Boolean(accessToken);

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
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  // Saving is only ever allowed once the guidebook loaded: a blank form saved over it would wipe it
  const [loaded, setLoaded] = useState(false);
  const loadedRef = useRef(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [pendingHouseMediaIndex, setPendingHouseMediaIndex] = useState<number | null>(null);
  const [showHouseMediaConfirm, setShowHouseMediaConfirm] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [templateKey, setTemplateKey] = useState<string>("template_original");
  const [publicSlug, setPublicSlug] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "retrying" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  // Only the preview on screen is mounted (side column from xl up, else the modal), so a save fetches the page once
  const wide = useMedia("(min-width: 1280px)");
  const previewRef = useRef<HTMLDivElement>(null);
  useDialog(previewOpen && !wide, () => setPreviewOpen(false), previewRef);

  // Check if this is first-time visiting edit page (skip on mobile)
  useEffect(() => {
    if (loaded) {
      const isMobile = window.innerWidth < 768; // Skip tutorial on mobile/tablet
      const hasSeenTutorial = localStorage.getItem('hasSeenEditTutorial') === 'true';
      if (!hasSeenTutorial && !isMobile) {
        setShowTutorial(true);
      }
    }
  }, [loaded]);

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

  // Fetch existing guidebook details, once per guidebook (not again on a token refresh)
  useEffect(() => {
    if (!guidebookId || !authReady) return;
    if (!signedIn) {
      router.push(loginPath());
      return;
    }
    // Editing is for saved guidebooks: guests create a free account first (their guidebook comes with them)
    if (isGuest) {
      router.replace("/signup?save=1");
      return;
    }
    if (loadedRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        setLoadError(null);
        const res = await fetch(`/api/guidebooks/${guidebookId}`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokenRef.current}`,
          },
        });
        if (cancelled) return;
        // 401 shouldn't occur because we verified accessToken above; still handle just in case
        if (res.status === 401) { router.push(loginPath()); return; }
        if (res.status === 404 || res.status === 400) { setNotFound(true); return; }
        if (!res.ok) throw new Error(`Failed to load guidebook (${res.status})`);
        const data: GuidebookDetail = await res.json();
        if (cancelled) return;

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

        setTemplateKey(data.template_key || "template_original");
        setPublicSlug(data.public_slug || null);
        try {
          sessionStorage.setItem("guidebookId", guidebookId);
          localStorage.setItem("guidebookId", guidebookId);
        } catch { }

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
          place_id: i.place_id || "",
        })));
        setActivityItems((data.things_to_do || []).map((i: Partial<DynamicItem>) => ({
          name: i.name || "",
          address: i.address || "",
          description: i.description || "",
          image_url: i.image_url || "",
          place_id: i.place_id || "",
        })));
        setCheckoutItems((data.checkout_info || []).map(i => ({ ...i, checked: true })));
        setHouseManualItems((data.house_manual || []).map(i => ({
          name: i.name || "",
          description: i.description || "",
          mediaUrl: i.media_url || "",
          mediaType: i.media_type === 'video' ? 'video' : i.media_type === 'image' ? 'image' : undefined,
        })));
        setRules((data.rules || []).map(rule => {
          // Handle new/JSON format: { name: string | { name, description } | null, description?: string | null }
          if (rule && typeof rule === 'object' && 'name' in rule) {
            const objRule = rule as {
              name?: string | { name?: string | null; description?: string | null } | null;
              description?: string | null;
            };
            const nameVal = objRule.name;
            const descVal = objRule.description;

            // Nested legacy format: { name: { name, description }, description: '' }
            if (nameVal && typeof nameVal === 'object' && ('name' in nameVal || 'description' in nameVal)) {
              const inner = nameVal as { name?: string | null; description?: string | null };
              return {
                name: inner.name ?? "",
                description: inner.description ?? (typeof descVal === 'string' ? descVal : ""),
                checked: true,
              };
            }

            return {
              name: typeof nameVal === 'string' ? nameVal : "",
              description: typeof descVal === 'string' ? descVal : "",
              checked: true,
            };
          }

          // Handle legacy string format: "name: description" or plain "name"
          if (typeof rule === 'string') {
            const [rawName, ...rest] = rule.split(":");
            const description = rest.length > 0 ? rest.join(":").trim() : "";
            return {
              name: rawName || rule,
              description,
              checked: true,
            };
          }

          return { name: "", description: "", checked: true };
        }));
        if (data.cover_image_url) setPreviewUrl(data.cover_image_url);
        if (data.host?.photo_url) setHostPhotoPreviewUrl(data.host.photo_url);
        loadedRef.current = true;
        setLoaded(true);
      } catch (e: unknown) {
        console.error(e);
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Failed to load guidebook");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [guidebookId, signedIn, authReady, loadAttempt, isGuest, router, setActivityItems, setCheckoutItems, setCustomSections, setCustomTabsMeta, setExcluded, setFoodItems, setFormData, setHostPhotoPreviewUrl, setHouseManualItems, setIncluded, setPreviewUrl, setRules]);

  // Image handlers are now provided by useGuidebookForm hook

  // Files that were already uploaded, so repeated saves do not upload them again
  const uploaded = useRef<{ cover?: { file: File; url: string }; host?: { file: File; url: string } }>({});

  /**
   * Uploads new photos and saves the whole guidebook. Returns false when the session has expired.
   * With `keepalive` (the page is closing) photos are not uploaded and the request outlives the page.
   */
  const persist = async (keepalive = false): Promise<boolean> => {
    if (!loadedRef.current) return false;
    let coverImageUrl: string | undefined = undefined;
    let hostPhotoUrl: string | undefined = undefined;
    if (keepalive) {
      coverImageUrl = uploaded.current.cover?.url;
      hostPhotoUrl = uploaded.current.host?.url;
    } else if (coverImage) {
      if (uploaded.current.cover?.file !== coverImage) {
        const url = await uploadToStorage('covers', coverImage);
        if (url) uploaded.current.cover = { file: coverImage, url };
      }
      coverImageUrl = uploaded.current.cover?.url;
    }
    if (hostPhoto && !keepalive) {
      if (uploaded.current.host?.file !== hostPhoto) {
        const url = await uploadToStorage('hosts', hostPhoto);
        if (url) uploaded.current.host = { file: hostPhoto, url };
      }
      hostPhotoUrl = uploaded.current.host?.url;
    }

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

    const res = await fetch(`/api/guidebooks/${guidebookId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {}),
      },
      body: JSON.stringify(payload),
      keepalive,
    });
    if (res.status === 401) {
      router.push(loginPath());
      return false;
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new SaveError(body.error || `Update failed (${res.status})`, res.status);
    }
    return true;
  };

  // Always the latest closure, so a save that starts later sees the latest edits
  const persistRef = useRef(persist);
  persistRef.current = persist;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    cancelRetry();
    try {
      if (baseline.current !== null) baseline.current = snapshotRef.current;
      if (!(await persistRef.current())) return;
      // A new guidebook goes on to share it; an existing one returns to the dashboard
      router.push(isNewGuidebook ? "/success" : "/dashboard?updated=true");
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "An unexpected error occurred. Please try again.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Autosave: the guidebook is live, so edits are saved shortly after you stop typing and the phone refreshes
  const saving = useRef(false);
  const again = useRef(false);
  const baseline = useRef<string | null>(null);
  const baselineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapshotRef = useRef("");
  // A save that failed on the network or the server is tried again on its own; a newer edit starts a fresh one instead
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retries = useRef(0);
  const unsaved = useRef(false);
  const cancelRetry = useCallback(() => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = null;
  }, []);
  const autosave = useCallback(async (retry = false) => {
    cancelRetry();
    if (!retry) retries.current = 0;
    if (!loadedRef.current) return;
    if (saving.current) {
      again.current = true;
      return;
    }
    saving.current = true;
    setSaveState("saving");
    try {
      do {
        again.current = false;
        if (snapshotRef.current) baseline.current = snapshotRef.current;
        if (!(await persistRef.current())) return;
      } while (again.current);
      unsaved.current = false;
      setSaveState("saved");
      setPreviewKey((k) => k + 1);
    } catch (err) {
      console.error("autosave failed", err);
      unsaved.current = true;
      const status = err instanceof SaveError ? err.status : 0;
      // fetch rejects with a TypeError when the request never got an answer
      if ((err instanceof TypeError || status >= 500 || status === 429) && retries.current < AUTOSAVE_RETRY_MS.length) {
        retryTimer.current = setTimeout(() => autosave(true), AUTOSAVE_RETRY_MS[retries.current++]);
        setSaveState("retrying");
      } else {
        // The server's reason for a refused save (a field too long, say) is shown; retrying wouldn't help
        setSaveError(status >= 400 && status < 500 && err instanceof Error ? err.message : null);
        setSaveState("error");
      }
    } finally {
      saving.current = false;
    }
  }, [cancelRetry]);
  useEffect(() => cancelRetry, [cancelRetry]);

  const snapshot = JSON.stringify([
    formData, foodItems, activityItems, rules, houseManualItems, checkoutItems, customSections, customTabsMeta, included,
    coverImage?.name ?? null, coverImage?.lastModified ?? null, hostPhoto?.name ?? null, hostPhoto?.lastModified ?? null,
  ]);
  snapshotRef.current = snapshot;

  // Leaving the page (closing the tab, or navigating away) before the debounce fires must not lose the last edit
  useEffect(() => {
    if (!loaded) return;
    const flush = () => {
      // A save still in flight is cancelled by the browser when the page unloads, so it is sent again with keepalive
      if (baseline.current === null || (snapshotRef.current === baseline.current && !saving.current && !unsaved.current)) return;
      baseline.current = snapshotRef.current;
      // The browser may reject the promise as the page unloads even though the keepalive request still completes
      persistRef.current(true).catch(() => {});
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [loaded]);

  useEffect(() => {
    if (!loaded) return;
    if (baseline.current === null) {
      // What was just loaded (plus state that settles in the renders right after) is the starting point.
      // Captured once: a timer that restarted on every change would swallow edits made right after the page opened.
      if (!baselineTimer.current) baselineTimer.current = setTimeout(() => { baseline.current = snapshotRef.current; }, 300);
      return;
    }
    if (snapshot === baseline.current) return;
    const t = setTimeout(autosave, 1200);
    return () => clearTimeout(t);
  }, [snapshot, loaded, autosave]);

  const switchTemplate = async (key: string) => {
    if (key === templateKey || !accessToken) return;
    if (isPremiumStyle(key) && !premiumStyles) {
      offerUpgrade(new UpgradeRequiredError(PREMIUM_STYLE_MESSAGE));
      return;
    }
    const previous = templateKey;
    setTemplateKey(key);
    try {
      const res = await fetch(`/api/guidebook/${guidebookId}/template`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ template_key: key }),
      });
      if (!res.ok) await throwApiError(res, "Could not change the style. Please try again.");
      setPreviewKey((k) => k + 1);
    } catch (e) {
      setTemplateKey(previous);
      if (!offerUpgrade(e)) setError("Could not change the style. Please try again.");
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

  if (loadError) {
    return (
      <div className="w-full min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4 text-center" role="alert">
        <h1 className="text-2xl font-semibold text-gray-800">Couldn&apos;t load this guidebook</h1>
        <p className="text-gray-600">Your guidebook is safe. Check your connection and try again.</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/dashboard")}>Back to dashboard</Button>
          <Button onClick={() => setLoadAttempt((n) => n + 1)} disabled={isLoading}>
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : null}
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (!loaded && !notFound) {
    return (
      <div className="w-full min-h-[60vh] flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-700">
          <Spinner size={22} colorClass="text-primary" />
          <span>Loading…</span>
        </div>
      </div>
    );
  }

  const STYLE_OPTIONS: [string, string][] = [
    ["template_signature", "Signature"],
    ["template_generic", "Lifestyle"],
    ["template_welcomebook", "Welcoming"],
  ];
  // Classic is no longer offered, but a guidebook already on it keeps showing it as the current style
  if (templateKey === "template_original") STYLE_OPTIONS.push(["template_original", "Classic"]);
  const isCurrentStyle = (key: string) => templateKey === key || (key === "template_generic" && templateKey === "template_lifestyle");

  const styleSwitcher = (
    <div className="w-full">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Guidebook style</p>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#EFE8DE] p-1" role="group" aria-label="Guidebook style">
        {STYLE_OPTIONS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => switchTemplate(key)}
            aria-pressed={isCurrentStyle(key)}
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg px-2 py-1.5 text-sm transition ${isCurrentStyle(key) ? "bg-white font-semibold text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
          >
            {label}
            {isPremiumStyle(key) && !premiumStyles && !isCurrentStyle(key) && (
              <span className="ml-1 inline-flex items-center gap-0.5 align-middle text-[10px] font-semibold uppercase text-primary" title={PREMIUM_STYLE_MESSAGE}>
                <Lock className="size-3" aria-hidden="true" />
                <span className="sr-only">{PREMIUM_STYLE_PLAN} plan</span>
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );

  const saveStatus = (
    <span className="inline-flex items-center gap-1.5 text-sm text-gray-500" aria-live="polite" data-save-status>
      {saveState === "saving" ? (
        <><Loader2 className="size-4 animate-spin" /> Saving…</>
      ) : saveState === "retrying" ? (
        <><Loader2 className="size-4 animate-spin" /> Couldn&apos;t save. Retrying…</>
      ) : saveState === "error" && saveError ? (
        <span className="text-red-600">{saveError}</span>
      ) : saveState === "error" ? (
        <span className="text-red-600">
          Couldn&apos;t save. Try Done or{" "}
          <button type="button" onClick={() => autosave()} className="font-medium underline underline-offset-2 hover:text-red-700">retry</button>.
        </span>
      ) : saveState === "saved" ? (
        <><Check className="size-4 text-emerald-600" /> Saved</>
      ) : (
        <><Check className="size-4 text-gray-400" /> Autosave on</>
      )}
    </span>
  );

  if (notFound) {
    return (
      <div className="w-full min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center">
        <h1 className="text-2xl font-semibold text-gray-800">Guidebook not found</h1>
        <p className="text-gray-600">It may have been deleted, or it belongs to another account.</p>
        <Button onClick={() => router.push("/dashboard")}>Back to dashboard</Button>
      </div>
    );
  }

  const liveUrl = publicSlug ? `/g/${publicSlug}` : null;
  const isCustom = currentSection.startsWith("custom_");
  const sectionMeta = SECTION_META[currentSection];
  const sectionLabel = sectionMeta?.label || customTabsMeta[currentSection]?.label || "Custom section";
  const sectionDescription = sectionMeta?.description || "Anything else guests should know.";
  const SectionIcon = sectionMeta?.icon;
  const sectionShown = included.includes(currentSection);
  const setSectionShown = (show: boolean) => {
    if (currentSection === "welcome") return;
    if (show) {
      setIncluded(insertInOrder(included, currentSection));
      setExcluded(excluded.filter((k) => k !== currentSection));
    } else {
      setIncluded(included.filter((k) => k !== currentSection));
      setExcluded([...excluded.filter((k) => k !== currentSection), currentSection]);
    }
  };

  /** Removes a custom section and its content, after asking (this frees a custom section slot) */
  const deleteCustomSection = (key: string) => {
    const label = customTabsMeta[key]?.label || "this section";
    showDialog({
      title: "Delete section?",
      message: `"${label}" and everything in it will be removed from your guidebook.`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      onConfirm: () => {
        setIncluded((prev) => prev.filter((k) => k !== key));
        setExcluded((prev) => prev.filter((k) => k !== key));
        setCustomSections((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        setCustomTabsMeta((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        if (currentSection === key) goToSection("welcome");
      },
    });
  };

  /** AI suggestions are added to the list (up to the limit) instead of replacing what the host already has. */
  const mergeSuggestions = (current: DynamicItem[], suggested: DynamicItem[]) => {
    const seen = new Set(current.map((i) => i.name.trim().toLowerCase()));
    const fresh = suggested.filter((i) => i.name && !seen.has(i.name.trim().toLowerCase()));
    return [...current, ...fresh].slice(0, LIMITS.maxFoodActivityItems);
  };

  const placesToolbar = (kind: "food" | "activities") => {
    const busy = kind === "food" ? isFetchingFood : isFetchingActivities;
    const items = kind === "food" ? foodItems : activityItems;
    const full = items.length >= LIMITS.maxFoodActivityItems;
    const needsAddress = !formData.location;
    return (
      <>
        <Button type="button" variant="outline" disabled={full} onClick={() => (kind === "food" ? setFoodPickerOpen(true) : setActivityPickerOpen(true))} className="rounded-xl">
          <Search className="size-4" /> Add from Google
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy || needsAddress || full}
          title={needsAddress ? "Add your address in Welcome first" : undefined}
          onClick={async () => {
            const suggested = kind === "food" ? await fetchFoodRecommendations(formData.location) : await fetchActivityRecommendations(formData.location);
            if (kind === "food") setFoodItems((prev) => mergeSuggestions(prev, suggested));
            else setActivityItems((prev) => mergeSuggestions(prev, suggested));
          }}
          className="rounded-xl"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4 text-primary" />}
          {busy ? "Finding places…" : "Suggest with AI"}
        </Button>
        {needsAddress && <span className="self-center text-xs text-gray-500">Add your address in Welcome to use suggestions.</span>}
      </>
    );
  };

  const topbar = (
    <div className="sticky top-14 z-30 border-b border-[#ECE5DB] bg-[#F8F5F1]/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-3 px-4 lg:px-6">
        <button type="button" onClick={() => router.push("/dashboard")} aria-label="Back to guidebooks" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-gray-600 hover:bg-white hover:text-gray-900">
          <ArrowLeft className="size-4" />
          <span className="hidden sm:inline">Guidebooks</span>
        </button>
        <span className="hidden h-6 w-px bg-[#E2D9CC] sm:block" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-gray-900">{formData.propertyName || "Untitled guidebook"}</p>
          <p className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" /> Live
            <span className="hidden sm:inline">· {saveStatus}</span>
          </p>
        </div>
        <button type="button" onClick={() => setPreviewOpen(true)} aria-label="Preview guidebook" className="inline-flex items-center gap-1.5 rounded-xl border border-[#E2D9CC] bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 xl:hidden">
          <Smartphone className="size-4" /> <span className="hidden sm:inline">Preview</span>
        </button>
        {liveUrl && (
          <a href={liveUrl} target="_blank" rel="noopener noreferrer" className="hidden items-center gap-1.5 rounded-xl border border-[#E2D9CC] bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:inline-flex">
            <ExternalLink className="size-4" /> View live
          </a>
        )}
        <Button type="button" data-tutorial="save-button" onClick={(e) => handleSubmit(e as unknown as React.FormEvent)} disabled={isLoading} className="h-10 rounded-xl px-5">
          {isLoading ? <Loader2 className="size-4 animate-spin" /> : null}
          {isNewGuidebook ? "Finish" : "Done"}
        </Button>
      </div>
    </div>
  );

  // Style picker sits above the phone so it's the first thing seen next to the preview
  const preview = (
    <div className="flex flex-col items-center gap-3">
      <div className="w-full max-w-[320px]">{styleSwitcher}</div>
      <div className="w-full max-w-[310px]">
        <PhonePreview guidebookId={guidebookId} accessToken={accessToken} refreshKey={previewKey} />
      </div>
    </div>
  );

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
        topbar={topbar}
        preview={wide ? preview : undefined}
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
              onDeleteCustom={deleteCustomSection}
            />
          </div>
        }
      >
        <div data-tutorial="content-area" className="mx-auto max-w-3xl">
          {/* Section header */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white text-primary shadow-sm ring-1 ring-[#ECE5DB]" aria-hidden="true">
                {SectionIcon ? <SectionIcon className="size-6" /> : <span className="text-2xl">{customTabsMeta[currentSection]?.icon || "📝"}</span>}
              </span>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{sectionLabel}</h1>
                <p className="mt-1 max-w-xl text-sm text-gray-500">{sectionDescription}</p>
              </div>
            </div>
            {currentSection !== "welcome" && (
              <div className="flex shrink-0 items-center gap-2">
                <div className="rounded-xl border border-[#ECE5DB] bg-white px-3 py-2">
                  <Switch checked={sectionShown} onChange={setSectionShown} label="Show in guidebook" />
                </div>
                {isCustom && (
                  <button type="button" onClick={() => deleteCustomSection(currentSection)} className="inline-flex items-center gap-1.5 rounded-xl border border-[#ECE5DB] bg-white px-3 py-2 text-sm text-gray-600 hover:border-red-200 hover:text-red-600">
                    <Trash2 className="size-4" /> Delete section
                  </button>
                )}
              </div>
            )}
          </div>

          {!sectionShown && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
              <EyeOff className="mt-0.5 size-4 shrink-0" />
              <span>This section is hidden from guests. Your edits are kept, and you can show it again any time.</span>
            </div>
          )}

          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {error}
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
                    items.map((it, i) => (i === idx ? { ...it, mediaUrl: undefined, mediaType: undefined } : it))
                  );
                  return;
                }
                try {
                  const url = await uploadHouseMedia('guide', file);
                  if (!url) return;
                  const mediaType = file.type && file.type.startsWith('video/') ? 'video' : 'image';
                  setHouseManualItems(items => items.map((it, i) => (i === idx ? { ...it, mediaUrl: url, mediaType } : it)));
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
          )}
          {currentSection === "food" && (
            <>
              <DynamicItemList
                items={foodItems}
                label="Places to eat"
                description="Restaurants, cafes and bars you'd send a friend to."
                toolbar={placesToolbar("food")}
                emptyHint="Search Google for your favorites, or let AI suggest popular spots near your address."
                onChange={(idx, field, value) => {
                  setFoodItems(items => items.map((item, i) => i === idx ? { ...item, [field]: value } : item));
                }}
                onAdd={() => setFoodItems(items => items.length >= LIMITS.maxFoodActivityItems ? items : [...items, { name: '', address: '', description: '' }])}
                onDelete={idx => setFoodItems(items => items.filter((_, i) => i !== idx))}
              />
              <PlacePickerModal
                open={foodPickerOpen}
                onClose={() => setFoodPickerOpen(false)}
                near={formData.location}
                title="Add a place to eat"
                onSelect={(item) => {
                  setFoodItems(items =>
                    items.length >= LIMITS.maxFoodActivityItems
                      ? items
                      : [...items, { name: item.name, address: item.address, description: item.description || '', image_url: item.image_url || '', place_id: item.place_id || '' }]
                  );
                }}
              />
            </>
          )}
          {currentSection === "activities" && (
            <>
              <DynamicItemList
                items={activityItems}
                label="Things to do"
                description="Walks, sights, markets and experiences nearby."
                toolbar={placesToolbar("activities")}
                emptyHint="Search Google for places you love, or let AI suggest highlights near your address."
                onChange={(idx, field, value) => {
                  setActivityItems(items => items.map((item, i) => i === idx ? { ...item, [field]: value } : item));
                }}
                onAdd={() => setActivityItems(items => items.length >= LIMITS.maxFoodActivityItems ? items : [...items, { name: '', address: '', description: '' }])}
                onDelete={idx => setActivityItems(items => items.filter((_, i) => i !== idx))}
              />
              <PlacePickerModal
                open={activityPickerOpen}
                onClose={() => setActivityPickerOpen(false)}
                near={formData.location}
                title="Add a thing to do"
                onSelect={(item) => {
                  setActivityItems(items =>
                    items.length >= LIMITS.maxFoodActivityItems
                      ? items
                      : [...items, { name: item.name, address: item.address, description: item.description || '', image_url: item.image_url || '', place_id: item.place_id || '' }]
                  );
                }}
              />
            </>
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
              onAdd={() => setRules([...rules, { name: '', description: '', checked: true }])}
              onAddWithValues={(rule) => setRules([...rules, { ...rule, checked: true }])}
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
              onAdd={() => setCheckoutItems(items => [...items, { name: '', description: '', checked: true }])}
              onAddWithValues={(item) => setCheckoutItems(items => [...items, { ...item, checked: true }])}
              onDelete={(idx: number) => setCheckoutItems(items => items.filter((_, i) => i !== idx))}
            />
          )}

          {isCustom && (
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

          {/* Next section, so hosts can work through the guidebook top to bottom */}
          {(() => {
            const order = [...included, ...excluded];
            const next = order[order.indexOf(currentSection) + 1];
            if (!next) return null;
            const nextLabel = SECTION_META[next]?.label || customTabsMeta[next]?.label || "Next section";
            return (
              <div className="mt-8 flex justify-end">
                <button type="button" onClick={() => { goToSection(next); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="inline-flex items-center gap-2 rounded-xl border border-[#E2D9CC] bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:border-primary/50 hover:text-gray-900">
                  Next: {nextLabel} <ArrowRight className="size-4" />
                </button>
              </div>
            );
          })()}
        </div>
      </CreateGuidebookLayout>

      {/* Preview on screens without the side column */}
      {previewOpen && !wide && (
        <div className="fixed inset-0 z-50 flex flex-col items-center overflow-y-auto bg-black/60 p-4 xl:hidden" onClick={() => setPreviewOpen(false)} role="dialog" aria-modal="true" aria-label="Guidebook preview">
          <div ref={previewRef} tabIndex={-1} className="my-auto flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl bg-[#F8F5F1] p-5 outline-none" onClick={(e) => e.stopPropagation()}>
            <div className="flex w-full items-center justify-between">
              <p className="font-semibold text-gray-900">Preview</p>
              <button type="button" onClick={() => setPreviewOpen(false)} className="inline-flex size-8 items-center justify-center rounded-lg text-gray-500 hover:bg-white" aria-label="Close preview">
                <X className="size-4" />
              </button>
            </div>
            {preview}
          </div>
        </div>
      )}

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
