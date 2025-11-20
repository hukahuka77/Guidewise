"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useGuidebookForm } from "@/hooks/useGuidebookForm";
import { useImageUpload } from "@/hooks/useImageUpload";
import { buildGuidebookPayload } from "@/utils/guidebookPayload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Spinner from "@/components/ui/spinner";
import PlacesAutocomplete from "@/components/PlacesAutocomplete";
import { CREATE_SECTIONS_ORDER } from "@/config/sections";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL as string;
const BUCKET_NAME = process.env.NEXT_PUBLIC_SUPABASE_FOOD_ACTIVITIES_BUCKET as string;
const HOUSE_MEDIA_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_USER_VIDEOS_BUCKET as string;

// Wizard steps
const STEPS = [
  { id: "intro", title: "Welcome", canSkip: false },
  { id: "location", title: "Location", canSkip: false },
  { id: "welcome", title: "Welcome Info", canSkip: true },
  { id: "host", title: "Host Info", canSkip: true },
  { id: "checkin", title: "Check-in", canSkip: true },
  { id: "wifi", title: "Wi-Fi", canSkip: true },
  { id: "checkout", title: "Checkout", canSkip: true },
  { id: "complete", title: "Complete", canSkip: false },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { accessToken } = useAuth({ requireAuth: true });
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkinItems, setCheckinItems] = useState<Array<{ name: string; description: string }>>([]);

  // Use consolidated form hook
  const {
    formData,
    setFormData,
    coverImage,
    hostPhoto,
    foodItems,
    activityItems,
    houseManualItems,
    setHouseManualItems,
    checkoutItems,
    setCheckoutItems,
    rules,
    setRules,
    included,
    customSections,
    customTabsMeta,
    handleCoverImageSelect,
    handleHostPhotoSelect,
    previewUrl,
    hostPhotoPreviewUrl,
  } = useGuidebookForm({
    initialIncluded: ["welcome", "checkin", "hostinfo", "wifi", "checkout"], // Sections covered in onboarding wizard
    initialExcluded: ["property", "food", "activities", "rules"], // Sections not in wizard
    useDefaults: true,
    initialCheckoutItems: [], // Start with empty checkout items in onboarding
    initialFormData: {
      welcomeMessage: "Welcome to our home! We're so excited to host you. This guidebook has everything you need to know for a comfortable stay. Please don't hesitate to reach out if you have any questions.",
      hostBio: "We're passionate about hospitality and love sharing our space with guests from around the world. We hope you enjoy your stay!",
    },
  });

  // Image upload hooks
  const { uploadToStorage } = useImageUpload({ bucketName: BUCKET_NAME });
  const { uploadToStorage: uploadHouseMedia } = useImageUpload({
    bucketName: HOUSE_MEDIA_BUCKET || BUCKET_NAME,
  });

  const currentStepData = STEPS[currentStep];
  const progress = ((currentStep + 1) / STEPS.length) * 100;

  // Keep address_street synced with location text input
  useEffect(() => {
    setFormData(prev => {
      if (prev.address_street === prev.location) return prev;
      return { ...prev, address_street: prev.location };
    });
  }, [formData.location, setFormData]);

  const handleNext = () => {
    setError(null);
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    setError(null);
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Upload images if selected
      let coverImageUrl: string | undefined = undefined;
      let hostPhotoUrl: string | undefined = undefined;
      if (coverImage) coverImageUrl = await uploadToStorage("covers", coverImage);
      if (hostPhoto) hostPhotoUrl = await uploadToStorage("hosts", hostPhoto);

      // Convert checkin items into formData fields
      const updatedFormData = { ...formData };
      checkinItems.forEach((item) => {
        const itemName = item.name.toLowerCase();
        if (itemName.includes('access') || itemName.includes('lock') || itemName.includes('key')) {
          updatedFormData.access_info = item.description;
        } else if (itemName.includes('parking')) {
          updatedFormData.parkingInfo = item.description;
        } else if (itemName.includes('emergency')) {
          updatedFormData.emergencyContact = item.description;
        } else if (itemName.includes('fire') || itemName.includes('extinguisher')) {
          updatedFormData.fireExtinguisherLocation = item.description;
        }
      });

      // Build payload
      const payload = buildGuidebookPayload({
        formData: updatedFormData,
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

      // Create draft guidebook
      const res = await fetch(`${API_BASE}/api/generate`, {
        method: "POST",
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
      if (!res.ok) throw new Error(`Failed to create guidebook (${res.status})`);

      const data = await res.json();
      const guidebookId = data.guidebook_id || data.id;

      // Publish snapshot
      try {
        await fetch(`${API_BASE}/api/guidebooks/${guidebookId}/publish`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
        });
      } catch (e) {
        console.warn("Snapshot publish failed:", e);
      }

      // Redirect to edit page with new flag
      router.push(`/edit/${guidebookId}?new=true`);
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Failed to create guidebook";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50">
      {/* Main Content */}
      <div className="pt-12 pb-12 px-6">
        <div className="max-w-3xl mx-auto">
          {/* Error Message */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}

          {/* Slide Content */}
          <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12 min-h-[500px] overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                {currentStepData.id === "intro" && <IntroSlide />}
                {currentStepData.id === "location" && (
                  <LocationSlide
                    location={formData.location}
                    onChange={(val) => setFormData((f) => ({ ...f, location: val }))}
                  />
                )}
                {currentStepData.id === "welcome" && (
                  <WelcomeSlide
                    welcomeMessage={formData.welcomeMessage}
                    propertyName={formData.propertyName}
                    coverPreviewUrl={previewUrl}
                    onChange={(id, val) => setFormData((f) => ({ ...f, [id]: val }))}
                    onCoverImageChange={handleCoverImageSelect}
                  />
                )}
                {currentStepData.id === "host" && (
                  <HostSlide
                    hostName={formData.hostName}
                    hostBio={formData.hostBio}
                    hostContact={formData.hostContact}
                    hostPhotoPreviewUrl={hostPhotoPreviewUrl}
                    onChange={(id, val) => setFormData((f) => ({ ...f, [id]: val }))}
                    onHostPhotoChange={handleHostPhotoSelect}
                  />
                )}
                {currentStepData.id === "checkin" && (
                  <CheckinSlide
                    checkInTime={formData.checkInTime}
                    items={checkinItems}
                    onChange={(id, val) => setFormData((f) => ({ ...f, [id]: val }))}
                    onItemChange={(idx, field, value) => {
                      setCheckinItems(items => items.map((item, i) =>
                        i === idx ? { ...item, [field]: value } : item
                      ));
                    }}
                    onAddItem={() => setCheckinItems([...checkinItems, { name: '', description: '' }])}
                    onDeleteItem={(idx) => setCheckinItems(items => items.filter((_, i) => i !== idx))}
                  />
                )}
                {currentStepData.id === "wifi" && (
                  <WifiSlide
                    wifiNetwork={formData.wifiNetwork}
                    wifiPassword={formData.wifiPassword}
                    onChange={(id, val) => setFormData((f) => ({ ...f, [id]: val }))}
                  />
                )}
                {currentStepData.id === "checkout" && (
                  <CheckoutSlide
                    checkOutTime={formData.checkOutTime}
                    items={checkoutItems}
                    onTimeChange={(val) => setFormData((f) => ({ ...f, checkOutTime: val }))}
                    onChange={(idx, field, val) =>
                      setCheckoutItems((items) =>
                        items.map((item, i) =>
                          i === idx
                            ? { ...item, [field]: field === "checked" ? Boolean(val) : String(val) }
                            : item
                        )
                      )
                    }
                    onAdd={() =>
                      setCheckoutItems((items) => [
                        ...items,
                        { name: "", description: "", checked: false },
                      ])
                    }
                    onDelete={(idx) =>
                      setCheckoutItems((items) => items.filter((_, i) => i !== idx))
                    }
                  />
                )}
                {currentStepData.id === "complete" && <CompleteSlide />}
              </motion.div>
            </AnimatePresence>

            {/* Progress Bar */}
            <div className="mt-8 mb-6">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-[oklch(0.6923_0.22_21.05)] h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <Button
                onClick={handleBack}
                disabled={currentStep === 0 || isSubmitting}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Back
              </Button>

              {currentStep < STEPS.length - 1 ? (
                <Button
                  onClick={handleNext}
                  disabled={isSubmitting || (currentStepData.id === "location" && !formData.location)}
                  className="px-8 py-3 bg-[oklch(0.6923_0.22_21.05)] text-white rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </Button>
              ) : (
                <Button
                  onClick={handleComplete}
                  disabled={isSubmitting}
                  className="px-8 py-3 bg-[oklch(0.6923_0.22_21.05)] text-white rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span className="inline-flex items-center gap-2">
                      <Spinner size={18} />
                      Creating...
                    </span>
                  ) : (
                    "Complete Setup"
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Slide Components
function IntroSlide() {
  return (
    <div className="text-center py-12">
      <h1 className="text-4xl font-bold text-gray-800 mb-4">
        Let's Create Your First Guidebook
      </h1>
      <p className="text-lg text-gray-600 max-w-2xl mx-auto">
        We'll gather the essentials now. You can add finishing touches later.
      </p>
    </div>
  );
}

function LocationSlide({
  location,
  onChange,
}: {
  location: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="py-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-3 text-center">Where is your property located?</h2>
      <p className="text-gray-600 mb-6 text-center">This helps us personalize your guidebook.</p>
      <Label htmlFor="location">
        Property Address <span className="text-red-500">*</span>
      </Label>
      <PlacesAutocomplete
        value={location}
        onChange={onChange}
        placeholder="Start typing an address..."
        className="mt-2"
      />
    </div>
  );
}

function WelcomeSlide({
  welcomeMessage,
  propertyName,
  coverPreviewUrl,
  onChange,
  onCoverImageChange,
}: {
  welcomeMessage: string;
  propertyName: string;
  coverPreviewUrl: string | null;
  onChange: (id: string, val: string) => void;
  onCoverImageChange: (file: File | null) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <div className="py-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-3 text-center">Welcome Info</h2>
      <p className="text-gray-600 mb-6 text-center">Add a warm greeting and property details.</p>

      <div className="space-y-4">
        <div>
          <Label htmlFor="welcomeMessage">Welcome Message</Label>
          <Textarea
            id="welcomeMessage"
            value={welcomeMessage}
            onChange={(e) => onChange("welcomeMessage", e.target.value)}
            placeholder="Write a friendly greeting..."
            className="mt-2"
            rows={4}
          />
        </div>

        <div>
          <Label htmlFor="propertyName">Property Name</Label>
          <Input
            id="propertyName"
            value={propertyName}
            onChange={(e) => onChange("propertyName", e.target.value)}
            placeholder="e.g. Sunny Retreat Guest House"
            className="mt-2"
          />
        </div>

        <div>
          <Label>Cover Image</Label>
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            id="coverImage"
            onChange={(e) => {
              const file = e.target.files?.[0] || null;
              onCoverImageChange(file);
            }}
          />
          <label htmlFor="coverImage">
            <div
              className={`mt-2 h-48 w-full rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer transition ${
                dragOver
                  ? "border-[oklch(0.6923_0.22_21.05)] bg-orange-50"
                  : "border-gray-300 hover:border-[oklch(0.6923_0.22_21.05)] hover:bg-orange-50"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files?.[0] || null;
                onCoverImageChange(file);
              }}
            >
              {coverPreviewUrl ? (
                <img
                  src={coverPreviewUrl}
                  alt="Cover"
                  className="h-full w-full object-cover rounded-xl"
                />
              ) : (
                <div className="text-center text-gray-500">
                  <p className="font-medium">Click to upload or drag & drop</p>
                  <p className="text-sm text-gray-400 mt-1">Property photo</p>
                </div>
              )}
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}

function HostSlide({
  hostName,
  hostBio,
  hostContact,
  hostPhotoPreviewUrl,
  onChange,
  onHostPhotoChange,
}: {
  hostName: string;
  hostBio: string;
  hostContact: string;
  hostPhotoPreviewUrl: string | null;
  onChange: (id: string, val: string) => void;
  onHostPhotoChange: (file: File | null) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <div className="py-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-3 text-center">Host Information</h2>
      <p className="text-gray-600 mb-6 text-center">Tell your guests a bit about yourself.</p>

      <div className="space-y-4">
        <div>
          <Label htmlFor="hostName">Your Name</Label>
          <Input
            id="hostName"
            value={hostName}
            onChange={(e) => onChange("hostName", e.target.value)}
            placeholder="e.g. John Doe"
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="hostBio">Bio</Label>
          <Textarea
            id="hostBio"
            value={hostBio}
            onChange={(e) => onChange("hostBio", e.target.value)}
            placeholder="A brief introduction about yourself..."
            className="mt-2"
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor="hostContact">Contact Information</Label>
          <Textarea
            id="hostContact"
            value={hostContact}
            onChange={(e) => onChange("hostContact", e.target.value)}
            placeholder="Phone, email, or other contact details..."
            className="mt-2"
            rows={2}
          />
        </div>

        <div>
          <Label>Your Photo</Label>
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            id="hostPhoto"
            onChange={(e) => {
              const file = e.target.files?.[0] || null;
              onHostPhotoChange(file);
            }}
          />
          <label htmlFor="hostPhoto">
            <div
              className={`mt-2 h-40 w-40 rounded-full border-2 border-dashed flex items-center justify-center cursor-pointer transition ${
                dragOver
                  ? "border-[oklch(0.6923_0.22_21.05)] bg-orange-50"
                  : "border-gray-300 hover:border-[oklch(0.6923_0.22_21.05)] hover:bg-orange-50"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files?.[0] || null;
                onHostPhotoChange(file);
              }}
            >
              {hostPhotoPreviewUrl ? (
                <img
                  src={hostPhotoPreviewUrl}
                  alt="Host"
                  className="h-full w-full object-cover rounded-full"
                />
              ) : (
                <div className="text-center text-gray-500 text-sm px-2">
                  <p>Click or drag</p>
                </div>
              )}
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}

function CheckinSlide({
  checkInTime,
  items,
  onChange,
  onItemChange,
  onAddItem,
  onDeleteItem,
}: {
  checkInTime: string;
  items: Array<{ name: string; description: string }>;
  onChange: (id: string, val: string) => void;
  onItemChange: (idx: number, field: string, value: string) => void;
  onAddItem: () => void;
  onDeleteItem: (idx: number) => void;
}) {
  const CHECKIN_SUGGESTIONS = [
    { name: "Access Instructions", description: "The key is in a lockbox on the front porch. Code: [CODE]. Turn the dial to the code and pull down to open." },
    { name: "Parking", description: "Free parking available in the driveway. Space for 2 vehicles." },
    { name: "Emergency Contact", description: "In case of emergency, call: +1 (555) 123-4567" },
    { name: "Fire Extinguisher", description: "Located under the kitchen sink" },
  ];

  const handleAddSuggestion = (suggestion: { name: string; description: string }) => {
    const existingIndex = items.findIndex(item => item.name.toLowerCase() === suggestion.name.toLowerCase());
    if (existingIndex >= 0) {
      onDeleteItem(existingIndex);
    } else {
      onAddItem();
      const newIndex = items.length;
      setTimeout(() => {
        onItemChange(newIndex, "name", suggestion.name);
        onItemChange(newIndex, "description", suggestion.description);
      }, 0);
    }
  };

  const isSuggestionActive = (suggestionName: string) => {
    return items.some(item => item.name.toLowerCase() === suggestionName.toLowerCase());
  };

  return (
    <div className="py-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-3 text-center">Check-in Details</h2>
      <p className="text-gray-600 mb-6 text-center">Help guests arrive smoothly.</p>

      <div className="space-y-6">
        <div>
          <Label htmlFor="checkInTime">Check-in Time</Label>
          <Input
            id="checkInTime"
            value={checkInTime}
            onChange={(e) => onChange("checkInTime", e.target.value)}
            placeholder="e.g. 3:00 PM"
            className="mt-2"
          />
        </div>

        <div>
          <Label className="text-center block">Check-in Information</Label>
          <div className="mt-4 flex flex-col items-center">
            <div className="flex flex-wrap justify-center gap-2 mb-2">
              {CHECKIN_SUGGESTIONS.map((suggestion) => {
                const isActive = isSuggestionActive(suggestion.name);
                return (
                  <Button
                    key={suggestion.name}
                    type="button"
                    onClick={() => handleAddSuggestion(suggestion)}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                      isActive
                        ? "bg-[oklch(0.6923_0.22_21.05)] text-white border border-[oklch(0.6923_0.22_21.05)] hover:opacity-90"
                        : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-[oklch(0.6923_0.22_21.05)]"
                    }`}
                  >
                    {isActive ? "✓ " : "+ "}{suggestion.name}
                  </Button>
                );
              })}
            </div>
            <p className="text-sm text-gray-400 italic">Quick add suggestions</p>
          </div>

          {items.length > 0 && (
            <div className="mt-6 space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="p-4 border rounded-lg bg-white space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <Input
                      value={item.name}
                      onChange={(e) => onItemChange(idx, "name", e.target.value)}
                      placeholder="Title"
                      className="font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => onDeleteItem(idx)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                      aria-label="Delete item"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  <Textarea
                    value={item.description}
                    onChange={(e) => onItemChange(idx, "description", e.target.value)}
                    placeholder="Description"
                    rows={2}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WifiSlide({
  wifiNetwork,
  wifiPassword,
  onChange,
}: {
  wifiNetwork: string;
  wifiPassword: string;
  onChange: (id: string, val: string) => void;
}) {
  return (
    <div className="py-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-3 text-center">Wi-Fi Information</h2>
      <p className="text-gray-600 mb-6 text-center">Share your Wi-Fi credentials.</p>

      <div className="space-y-4">
        <div>
          <Label htmlFor="wifiNetwork">Network Name</Label>
          <Input
            id="wifiNetwork"
            value={wifiNetwork}
            onChange={(e) => onChange("wifiNetwork", e.target.value)}
            placeholder="e.g. MyHomeWiFi"
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="wifiPassword">Password</Label>
          <Input
            id="wifiPassword"
            type="text"
            value={wifiPassword}
            onChange={(e) => onChange("wifiPassword", e.target.value)}
            placeholder="Wi-Fi password"
            className="mt-2"
          />
        </div>
      </div>
    </div>
  );
}

function PropertySlide({
  items,
  onChange,
  onAdd,
  onDelete,
  onMediaSelect,
}: {
  items: Array<{ name: string; description: string; mediaUrl?: string; mediaType?: string }>;
  onChange: (idx: number, field: string, val: string) => void;
  onAdd: () => void;
  onDelete: (idx: number) => void;
  onMediaSelect: (idx: number, file: File | null) => void;
}) {
  return (
    <div className="py-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-3">House Manual</h2>
      <p className="text-gray-600 mb-6">Add instructions for appliances, amenities, etc.</p>

      <div className="space-y-4">
        {items.map((item, idx) => (
          <div key={idx} className="border rounded-lg p-4 bg-gray-50">
            <div className="flex items-start justify-between mb-3">
              <Input
                placeholder="Item name (e.g. Coffee Maker)"
                value={item.name}
                onChange={(e) => onChange(idx, "name", e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={() => onDelete(idx)}
                className="ml-2 px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Remove
              </Button>
            </div>
            <Textarea
              placeholder="Instructions..."
              value={item.description}
              onChange={(e) => onChange(idx, "description", e.target.value)}
              rows={2}
            />
          </div>
        ))}

        <Button
          onClick={onAdd}
          className="w-full py-3 border-2 border-dashed border-gray-300 bg-white text-gray-600 rounded-lg hover:border-[oklch(0.6923_0.22_21.05)] hover:text-[oklch(0.6923_0.22_21.05)]"
        >
          + Add Item
        </Button>
      </div>
    </div>
  );
}

function RulesSlide({
  rules,
  onChange,
  onAdd,
}: {
  rules: Array<{ name: string; description: string; checked: boolean }>;
  onChange: (idx: number, field: string, val: string | boolean) => void;
  onAdd: () => void;
}) {
  return (
    <div className="py-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-3">House Rules</h2>
      <p className="text-gray-600 mb-6">Set expectations for your guests.</p>

      <div className="space-y-4">
        {rules.map((rule, idx) => (
          <div key={idx} className="border rounded-lg p-4 bg-gray-50">
            <Input
              placeholder="Rule (e.g. No smoking)"
              value={rule.name}
              onChange={(e) => onChange(idx, "name", e.target.value)}
              className="mb-2"
            />
            <Textarea
              placeholder="Additional details (optional)..."
              value={rule.description}
              onChange={(e) => onChange(idx, "description", e.target.value)}
              rows={2}
            />
          </div>
        ))}

        <Button
          onClick={onAdd}
          className="w-full py-3 border-2 border-dashed border-gray-300 bg-white text-gray-600 rounded-lg hover:border-[oklch(0.6923_0.22_21.05)] hover:text-[oklch(0.6923_0.22_21.05)]"
        >
          + Add Rule
        </Button>
      </div>
    </div>
  );
}

function CheckoutSlide({
  checkOutTime,
  items,
  onTimeChange,
  onChange,
  onAdd,
  onDelete,
}: {
  checkOutTime: string;
  items: Array<{ name: string; description: string; checked: boolean }>;
  onTimeChange: (val: string) => void;
  onChange: (idx: number, field: string, val: string | boolean) => void;
  onAdd: () => void;
  onDelete: (idx: number) => void;
}) {
  const CHECKOUT_SUGGESTIONS = [
    { name: "Trash", description: "Please bag all trash and place it in the outside bin." },
    { name: "Dishes", description: "Load and run the dishwasher (or hand wash any used dishes)." },
    { name: "Lights", description: "Turn off all lights throughout the property." },
    { name: "Thermostat", description: "Set thermostat to 72°F." },
    { name: "Lock Doors", description: "Ensure all doors and windows are locked." },
  ];

  const handleAddSuggestion = (suggestion: { name: string; description: string }) => {
    // Check if this suggestion is already added
    const existingIndex = items.findIndex(item => item.name.toLowerCase() === suggestion.name.toLowerCase());

    if (existingIndex >= 0) {
      // If it exists, remove it
      onDelete(existingIndex);
    } else {
      // If it doesn't exist, add it
      onAdd();
      // Set the values for the newly added item (which is at the end)
      const newIndex = items.length;
      setTimeout(() => {
        onChange(newIndex, "name", suggestion.name);
        onChange(newIndex, "description", suggestion.description);
      }, 0);
    }
  };

  const isSuggestionActive = (suggestionName: string) => {
    return items.some(item => item.name.toLowerCase() === suggestionName.toLowerCase());
  };

  return (
    <div className="py-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-3 text-center">Checkout Information</h2>
      <p className="text-gray-600 mb-6 text-center">What should guests do before they leave?</p>

      <div className="space-y-4">
        <div>
          <Label htmlFor="checkOutTime">Checkout Time</Label>
          <Input
            id="checkOutTime"
            value={checkOutTime}
            onChange={(e) => onTimeChange(e.target.value)}
            placeholder="e.g. 11:00 AM"
            className="mt-2"
          />
        </div>

        <div>
          <Label>Checkout Checklist</Label>

          <div className="flex flex-wrap justify-center gap-2 mt-3 mb-2">
            {CHECKOUT_SUGGESTIONS.map((suggestion, idx) => {
              const isActive = isSuggestionActive(suggestion.name);
              return (
                <Button
                  key={idx}
                  type="button"
                  onClick={() => handleAddSuggestion(suggestion)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    isActive
                      ? "bg-[oklch(0.6923_0.22_21.05)] text-white border border-[oklch(0.6923_0.22_21.05)] hover:opacity-90"
                      : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-[oklch(0.6923_0.22_21.05)]"
                  }`}
                >
                  {isActive ? "✓ " : "+ "}{suggestion.name}
                </Button>
              );
            })}
          </div>
          <p className="text-sm text-gray-400 italic text-center mb-4">Quick add suggestions</p>

          <div className="space-y-3 mt-2">
            {items.map((item, idx) => (
              <div key={idx} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-start gap-2 mb-2">
                  <Input
                    placeholder="Task (e.g. Turn off lights)"
                    value={item.name}
                    onChange={(e) => onChange(idx, "name", e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    onClick={() => onDelete(idx)}
                    className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18"></path>
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                    </svg>
                  </Button>
                </div>
                <Textarea
                  placeholder="Additional details (optional)..."
                  value={item.description}
                  onChange={(e) => onChange(idx, "description", e.target.value)}
                  rows={2}
                />
              </div>
            ))}

            <Button
              type="button"
              onClick={onAdd}
              className="w-full py-3 border-2 border-dashed border-gray-300 bg-white text-gray-600 rounded-lg hover:border-[oklch(0.6923_0.22_21.05)] hover:text-[oklch(0.6923_0.22_21.05)]"
            >
              + Add Checklist Item
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CompleteSlide() {
  return (
    <div className="text-center py-12">
      <h1 className="text-4xl font-bold text-gray-800 mb-4">You're All Set!</h1>
      <p className="text-lg text-gray-600 max-w-2xl mx-auto">
        Let's finalize your guidebook and add any finishing touches.
      </p>
    </div>
  );
}
