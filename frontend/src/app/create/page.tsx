"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from '@/components/ui/textarea'; // Importing the new Textarea component

export default function CreateGuidebookPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    propertyName: '',
    hostName: '',
    address: '',
    address_street: '',
    address_city_state: '',
    address_zip: '',
    access_info: '',
    rules: '',
    wifiNetwork: '',
    wifiPassword: '',
    checkInTime: '15:00',
    checkOutTime: '11:00',
    thingsToDo: 5,
    placesToEat: 5,
  });

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

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 py-12">
              <div className="mx-auto w-full max-w-2xl space-y-8 bg-white p-10 rounded-lg shadow-md">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
              <strong className="font-bold">Error:</strong>
              <span className="block sm:inline"> {error}</span>
            </div>
          )}
        {step === 1 && (
          <form onSubmit={(e) => { e.preventDefault(); nextStep(); }}>
            <div className="space-y-2 text-center">
              <h1 className="text-3xl font-bold">Create Your Guidebook</h1>
              <p className="text-gray-500">Step 1: Property Details</p>
            </div>
            <div className="space-y-4 mt-8">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="propertyName">Property Name</Label>
                  <Input id="propertyName" placeholder="e.g. The Cozy Cottage" value={formData.propertyName} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hostName">Host Name</Label>
                  <Input id="hostName" placeholder="e.g. Jane Doe" value={formData.hostName} onChange={handleChange} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Full Address (for AI lookups)</Label>
                <Input id="address" placeholder="e.g. 123 Main Street, Anytown, USA" value={formData.address} onChange={handleChange} required />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="address_street">Street</Label>
                  <Input id="address_street" placeholder="e.g. 123 Main Street" value={formData.address_street} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address_zip">Zip Code</Label>
                  <Input id="address_zip" placeholder="e.g. 12345" value={formData.address_zip} onChange={handleChange} required />
                </div>
              </div>
              <div className="space-y-2">
                  <Label htmlFor="address_city_state">City & State</Label>
                  <Input id="address_city_state" placeholder="e.g. Anytown, USA" value={formData.address_city_state} onChange={handleChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="access_info">Access Information</Label>
                <Textarea id="access_info" placeholder="e.g. The key is under the mat. The code for the lockbox is 1234." value={formData.access_info} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rules">House Rules (one rule per line)</Label>
                <Textarea id="rules" placeholder="- No smoking\n- Quiet hours after 10pm" value={formData.rules} onChange={handleChange} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="wifiNetwork">WiFi Network</Label>
                  <Input id="wifiNetwork" placeholder="e.g. MySuperFastWiFi" value={formData.wifiNetwork} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wifiPassword">WiFi Password</Label>
                  <Input id="wifiPassword" placeholder="e.g. guest1234" value={formData.wifiPassword} onChange={handleChange} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="checkInTime">Check-in Time</Label>
                  <Input id="checkInTime" type="time" value={formData.checkInTime} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="checkOutTime">Check-out Time</Label>
                  <Input id="checkOutTime" type="time" value={formData.checkOutTime} onChange={handleChange} />
                </div>
              </div>
            </div>
            <Button className="w-full mt-8" type="submit">
              Next: Cover Image
            </Button>
          </form>
        )} 

        {step === 2 && (
          <form onSubmit={(e) => { e.preventDefault(); nextStep(); }}>
            <div className="space-y-2 text-center">
              <h1 className="text-3xl font-bold">Upload a Cover Image</h1>
              <p className="text-gray-500">Step 2: Make it beautiful</p>
            </div>
            <div className="space-y-4 mt-8">
              <div className="space-y-2">
                <Label htmlFor="coverImage">Cover Image</Label>
                <Input id="coverImage" type="file" accept="image/*" onChange={handleImageChange} />
              </div>
              {previewUrl && (
                <div className="mt-4">
                  <img src={previewUrl} alt="Cover preview" className="w-full h-auto rounded-lg" />
                </div>
              )}
            </div>
            <div className="flex justify-between mt-8">
                <Button type="button" variant="outline" onClick={prevStep}>
                    Back
                </Button>
                <Button type="submit">
                  Next: AI Recommendations
                </Button>
            </div>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={handleSubmit}>
            <div className="space-y-2 text-center">
              <h1 className="text-3xl font-bold">AI Recommendations</h1>
              <p className="text-gray-500">Step 3: Customize Your Guide</p>
            </div>
            <div className="space-y-4 mt-8">
                <div className="space-y-2">
                  <Label htmlFor="thingsToDo">Number of Things to Do</Label>
                  <Input id="thingsToDo" type="number" min="1" max="10" value={formData.thingsToDo} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="placesToEat">Number of Places to Eat</Label>
                  <Input id="placesToEat" type="number" min="1" max="10" value={formData.placesToEat} onChange={handleChange} />
                </div>
            </div>
            <div className="flex justify-between mt-8">
                <Button type="button" variant="outline" onClick={prevStep}>
                    Back
                </Button>
                <Button type="submit"  disabled={isLoading}>
                  {isLoading ? 'Generating...' : 'Generate Guidebook'}
                </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
