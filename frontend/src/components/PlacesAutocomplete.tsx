/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PlacesAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

// Loads Google Places script if not already present
function loadGoogleScript(apiKey: string) {
  if (typeof window === "undefined" || window.google) return;
  if (document.getElementById("google-maps-script")) return;
  const script = document.createElement("script");
  script.id = "google-maps-script";
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
  script.async = true;
  document.body.appendChild(script);
}

const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || process.env.GOOGLE_API_KEY;

// Minimal ambient declaration to satisfy TS without external type packages
declare global {
  interface Window {
    google?: any;
  }
}

const PlacesAutocomplete: React.FC<PlacesAutocompleteProps> = ({ value, onChange, placeholder, className }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any | null>(null);

  useEffect(() => {
    if (!GOOGLE_API_KEY) return;
    loadGoogleScript(GOOGLE_API_KEY);
    const interval = setInterval(() => {
      if (window.google && window.google.maps && window.google.maps.places) {
        if (inputRef.current && !autocompleteRef.current) {
          autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
            types: ["geocode", "establishment"],
            fields: ["formatted_address", "geometry", "name"],
          });
          autocompleteRef.current.addListener("place_changed", () => {
            const place = autocompleteRef.current!.getPlace();
            if (place.formatted_address) {
              onChange(place.formatted_address);
            } else if (place.name) {
              onChange(place.name);
            }
          });
        }
        clearInterval(interval);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [onChange]);

  return (
    <Input
      ref={inputRef}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder || "Enter a location"}
      className={cn("w-full", className)}
      autoComplete="off"
      id="location-autocomplete"
      name="location"
      type="text"
    />
  );
};

export default PlacesAutocomplete;
