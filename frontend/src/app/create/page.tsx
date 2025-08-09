"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from '@/components/ui/textarea'; // Importing the new Textarea component

import SidebarNav, { NavGuardContext } from "./SidebarNav";
import CreateGuidebookLayout from "./CreateGuidebookLayout";
import ArrivalSection from "./ArrivalSection";
import WifiSection from "./WifiSection";
import CheckinSection from "./CheckinSection";
import HostInfoSection from "./HostInfoSection";
import PropertySection from "./PropertySection";
import DynamicItemList, { DynamicItem } from "./DynamicItemList";
import RulesSection from "./RulesSection";
import CheckoutSection from "./CheckoutSection";

export default function CreateGuidebookPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  // Ordered sections for sequential navigation
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
    address: '123 Beachside Ave',
    address_street: '123 Beachside Ave',
    address_city_state: 'Santa Monica, CA',
    address_zip: '90401',
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
  const [rules, setRules] = useState<{ name: string; description: string; checked: boolean }[]>([
    { name: 'No Smoking', description: 'Smoking is not allowed inside the house or on the balcony.', checked: true },
    { name: 'No Parties or Events', description: 'Parties and events are not allowed on the property.', checked: true },
    { name: 'No Pets', description: 'Pets are not allowed unless approved in advance.', checked: true },
    { name: 'Quiet Hours', description: 'Please keep noise to a minimum after 10pm to respect our neighbors.', checked: true },
    { name: 'No Unregistered Guests', description: 'Only guests included in the reservation are allowed to stay.', checked: true },
    { name: 'Remove Shoes Indoors', description: 'Please remove your shoes when entering the house.', checked: true }
  ]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [id]: type === 'number' ? parseInt(value, 10) : value,
    }));
  };

  const handleCoverImageSelect = (file: File | null) => {
    setCoverImage(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  };

  const handleHostPhotoSelect = (file: File | null) => {
    setHostPhoto(file);
    setHostPhotoPreviewUrl(file ? URL.createObjectURL(file) : null);
  };

  const nextStep = () => setStep((prev) => prev + 1);
  const prevStep = () => setStep((prev) => prev - 1);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        things_to_do: activityItems.map(i => ({ name: i.name, description: i.description, image_url: (i as any).image_url || "", address: (i as any).address || "" })),
        places_to_eat: foodItems.map(i => ({ name: i.name, description: i.description, image_url: (i as any).image_url || "", address: (i as any).address || "" })),
        checkout_info: checkoutItems.filter(i => i.checked).map(i => ({ name: i.name, description: i.description })),
      };

      const response = await fetch('http://localhost:5001/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Get the live URL from the custom header
      const liveUrlPath = response.headers.get('X-Guidebook-Url');
      if (liveUrlPath) {
        const fullLiveUrl = `http://localhost:5001${liveUrlPath}`;
        sessionStorage.setItem('liveGuidebookUrl', fullLiveUrl);
      }

      // The response body is the PDF file itself
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      sessionStorage.setItem('guidebookUrl', downloadUrl);

      router.push('/success');

    } catch (err: any) {
      console.error('Failed to generate guidebook:', err);
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Navigation state for sidebar
  const [currentSection, setCurrentSection] = useState<string>("checkin");
  const [visitedMaxIndex, setVisitedMaxIndex] = useState<number>(0);
  const [visited, setVisited] = useState<Set<string>>(new Set(["checkin"]));

  const currentIndex = sectionsOrder.indexOf(currentSection as typeof sectionsOrder[number]);
  const allVisited = visited.size === sectionsOrder.length;

  const goToSection = (section: string) => {
    setCurrentSection(section);
    const idx = sectionsOrder.indexOf(section as typeof sectionsOrder[number]);
    if (idx > visitedMaxIndex) setVisitedMaxIndex(idx);
    setVisited(prev => new Set([...prev, section]));
  };

  const goNext = () => {
    if (currentIndex < sectionsOrder.length - 1) {
      const next = sectionsOrder[currentIndex + 1];
      goToSection(next);
    }
  };

  return (
    <NavGuardContext.Provider value={{ locationFilled: !!formData.location }}>
      <CreateGuidebookLayout
        sidebar={<SidebarNav currentSection={currentSection} onSectionChange={goToSection} visitedMaxIndex={visitedMaxIndex} allVisited={allVisited} />}
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
          const res = await fetch("http://localhost:5001/api/ai-food", {
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
            setFoodItems(items.map((item: any) => ({
              name: item.name || "",
              address: item.address || "",
              description: item.description || "",
              image_url: item.image_url || ""
            })));
          } else {
            setError("No recommendations found.");
          }
        } catch (e: any) {
          setError(e.message || "Failed to fetch recommendations");
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
          const res = await fetch("http://localhost:5001/api/ai-activities", {
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
            setActivityItems(items.map((item: any) => ({
              name: item.name || "",
              address: item.address || "",
              description: item.description || "",
              image_url: item.image_url || ""
            })));
          } else {
            setError("No recommendations found.");
          }
        } catch (e: any) {
          setError(e.message || "Failed to fetch recommendations");
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
      {currentSection === "checkout" && (
        <CheckoutSection
          checkoutTime={formData.checkOutTime}
          items={checkoutItems}
          onTimeChange={(value: string) => setFormData(f => ({ ...f, checkOutTime: value }))}
          onChange={(idx, field, value) => {
            setCheckoutItems(items => items.map((item, i) => i === idx ? { ...item, [field]: value as any } : item));
          }}
          onAdd={() => setCheckoutItems(items => [...items, { name: '', description: '', checked: false }])}
          onDelete={(idx) => setCheckoutItems(items => items.filter((_, i) => i !== idx))}
        />
      )}
      {currentSection === "arrival" && (
        <ArrivalSection checkInTime={formData.checkInTime} onChange={(id, value) => setFormData(f => ({ ...f, [id]: value }))} />
      )}
      {/* Footer Actions: Next or Publish */}
      <div className="mt-8 flex justify-end">
        <Button
          type="button"
          className="px-6 py-2 bg-[oklch(0.6923_0.22_21.05)] text-white font-semibold rounded shadow hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={(e) => {
            if (allVisited || currentIndex === sectionsOrder.length - 1) {
              return handleSubmit(e as unknown as React.FormEvent);
            }
            return goNext();
          }}
          disabled={
            isLoading ||
            (!formData.location && currentSection === "checkin") ||
            // Host name required: block on hostinfo and whenever Publish would be available
            (!formData.hostName?.trim() && (
              currentSection === "hostinfo" || allVisited || currentIndex === sectionsOrder.length - 1
            ))
          }
        >
          {isLoading
            ? "Processing…"
            : (allVisited || currentIndex === sectionsOrder.length - 1)
              ? "Publish"
              : "Next Page"}
        </Button>
      </div>
      </CreateGuidebookLayout>
    </NavGuardContext.Provider>
  );


}
