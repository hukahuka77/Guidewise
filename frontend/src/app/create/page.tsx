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
import DynamicItemList, { DynamicItem } from "./DynamicItemList";
import RulesSection from "./RulesSection";
import CheckoutSection from "./CheckoutSection";

export default function CreateGuidebookPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    propertyName: 'Sunny Retreat Guest House',
    hostName: '', // Placeholder only
    hostBio: 'I love hosting guests from around the world and sharing my favorite local spots. Let me know if you need anything during your stay!',
    hostContact: '', // Placeholder only
    address: '123 Beachside Ave',
    address_street: '123 Beachside Ave',
    address_city_state: 'Santa Monica, CA',
    address_zip: '90401',
    access_info: 'Front door code: 4321#\nSpare key in lockbox by the garage.',
    welcomeMessage: 'Welcome to your home away from home! We hope you have a relaxing and memorable stay.',
    location: '', // Only required field, leave blank
    parkingInfo: 'You have a reserved spot in front of the garage. Street parking is also available.',
    wifiNetwork: '', // Placeholder only
    wifiPassword: '', // Placeholder only
    wifiNotes: 'WiFi works best in the living room and kitchen. Please let us know if you have any issues.',
    checkInTime: '15:00',
    checkOutTime: '11:00',
    checkoutRequirements: '', // Placeholder only
  });
  const [foodItems, setFoodItems] = useState<DynamicItem[]>([]);
  const [activityItems, setActivityItems] = useState<DynamicItem[]>([]);
  const [rules, setRules] = useState<{ name: string; description: string; checked: boolean }[]>([
    { name: 'No Smoking', description: 'Smoking is not allowed inside the house or on the balcony.', checked: true },
    { name: 'No Parties or Events', description: 'Parties and events are not allowed on the property.', checked: true },
    { name: 'No Pets', description: 'Pets are not allowed unless approved in advance.', checked: false },
    { name: 'Quiet Hours', description: 'Please keep noise to a minimum after 10pm to respect our neighbors.', checked: true },
    { name: 'No Unregistered Guests', description: 'Only guests included in the reservation are allowed to stay.', checked: true },
    { name: 'Remove Shoes Indoors', description: 'Please remove your shoes when entering the house.', checked: false },
    { name: 'Turn Off Lights/AC', description: 'Turn off all lights and AC when leaving the property.', checked: false }
  ]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [id]: type === 'number' ? parseInt(value, 10) : value,
    }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCoverImage(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
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
      if (coverImage) {
        coverImageUrl = await toBase64(coverImage);
      }

      // Prepare the JSON payload with snake_case keys for the backend
      const payload = {
        property_name: formData.propertyName,
        host_name: formData.hostName,
        address_street: formData.address_street,
        address_city_state: formData.address_city_state,
        address_zip: formData.address_zip,
        access_info: formData.access_info,
        wifi_network: formData.wifiNetwork,
        wifi_password: formData.wifiPassword,
        check_in_time: formData.checkInTime,
        check_out_time: formData.checkOutTime,
        rules: (formData.rules as string).split('\n').filter((line: string) => line.trim() !== ''),
        cover_image_url: coverImageUrl,
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

  return (
    <NavGuardContext.Provider value={{ locationFilled: !!formData.location }}>
      <CreateGuidebookLayout
        sidebar={<SidebarNav currentSection={currentSection} onSectionChange={setCurrentSection} />}
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
          onChange={(id, value) => setFormData(f => ({ ...f, [id]: value }))}
        />
      )}
      {currentSection === "hostinfo" && (
        <HostInfoSection
          name={formData.hostName}
          bio={formData.hostBio}
          contact={formData.hostContact}
          onChange={(id, value) => setFormData(f => ({ ...f, [id]: value }))}
        />
      )}
      {currentSection === "wifi" && (
        <WifiSection wifiNetwork={formData.wifiNetwork} wifiPassword={formData.wifiPassword} onChange={(id, value) => setFormData(f => ({ ...f, [id]: value }))} />
      )}
      {currentSection === "food" && (
  <div>
    <button
      type="button"
      className="mb-4 px-4 py-2 rounded bg-pink-500 text-white font-semibold shadow hover:bg-pink-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
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
      className="mb-4 px-4 py-2 rounded bg-pink-500 text-white font-semibold shadow hover:bg-pink-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
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
          requirements={formData.checkoutRequirements}
          onChange={(id, value) => setFormData(f => ({ ...f, [id]: value }))}
          requirementsPlaceholder="e.g. Please place used towels in the basket and take out the trash before you leave."
        />
      )}
      {currentSection === "arrival" && (
        <ArrivalSection checkInTime={formData.checkInTime} onChange={(id, value) => setFormData(f => ({ ...f, [id]: value }))} />
      )}
      </CreateGuidebookLayout>
    </NavGuardContext.Provider>
  );


}
