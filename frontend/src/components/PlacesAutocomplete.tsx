/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PlacesAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

declare global {
  interface Window {
    google?: any;
  }
}

const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
const MIN_CHARS = 3;
const DEBOUNCE_MS = 250;

let placesLibrary: Promise<any> | null = null;

/** Google's Places library (Maps JavaScript API, loaded once per page). */
function loadPlaces(apiKey: string): Promise<any> {
  if (!placesLibrary) {
    placesLibrary = new Promise((resolve, reject) => {
      const ready = () => window.google.maps.importLibrary("places").then(resolve, reject);
      if (window.google?.maps?.importLibrary) return ready();
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&libraries=places`;
      script.async = true;
      script.onload = () => {
        // With loading=async the loader finishes setting up just after the script runs
        const wait = () => (window.google?.maps?.importLibrary ? ready() : setTimeout(wait, 50));
        wait();
      };
      script.onerror = () => {
        placesLibrary = null;
        reject(new Error("Google Maps failed to load"));
      };
      document.head.appendChild(script);
    });
  }
  return placesLibrary;
}

interface Suggestion {
  text: string;
  prediction: any;
}

/**
 * An address field with Google suggestions (Places API (New) autocomplete). Typing into it works
 * without Google too. Suggestions in one session are free once a picked address is looked up, and the
 * lookup asks only for the formatted address (billed at the cheapest tier).
 */
const PlacesAutocomplete: React.FC<PlacesAutocompleteProps> = ({ value, onChange, placeholder, className }) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const session = useRef<any>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef("");

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const lookUp = (input: string) => {
    latest.current = input;
    if (timer.current) clearTimeout(timer.current);
    if (!GOOGLE_API_KEY || input.trim().length < MIN_CHARS) {
      setSuggestions([]);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const places = await loadPlaces(GOOGLE_API_KEY);
        session.current ??= new places.AutocompleteSessionToken();
        const { suggestions: found } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({ input, sessionToken: session.current });
        if (latest.current !== input) return; // the user kept typing
        setSuggestions(
          (found || [])
            .filter((s: any) => s.placePrediction)
            .slice(0, 5)
            .map((s: any) => ({ text: s.placePrediction.text.toString(), prediction: s.placePrediction })),
        );
        setActive(-1);
        setOpen(true);
      } catch {
        setSuggestions([]);
      }
    }, DEBOUNCE_MS);
  };

  const pick = async (s: Suggestion) => {
    setOpen(false);
    setSuggestions([]);
    latest.current = "";
    onChange(s.text);
    try {
      const place = s.prediction.toPlace();
      await place.fetchFields({ fields: ["formattedAddress"] });
      if (place.formattedAddress) onChange(place.formattedAddress);
    } catch {
      // keep the suggestion's text
    } finally {
      session.current = null; // the lookup ends the billing session
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      void pick(suggestions[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const showList = open && suggestions.length > 0;
  return (
    <div className="relative w-full">
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          lookUp(e.target.value);
        }}
        onKeyDown={onKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder || "Enter a location"}
        className={cn("w-full", className)}
        autoComplete="off"
        id="location-autocomplete"
        name="location"
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls="location-suggestions"
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? `location-suggestion-${active}` : undefined}
      />
      {showList && (
        <ul
          id="location-suggestions"
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl bg-white py-1 text-left text-sm shadow-lg ring-1 ring-black/10"
        >
          {suggestions.map((s, i) => (
            <li
              key={`${s.text}-${i}`}
              id={`location-suggestion-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown, so the pick lands before the field's blur closes the list
              onMouseDown={(e) => {
                e.preventDefault();
                void pick(s);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn("cursor-pointer px-4 py-2.5 text-[#1f1a17]", i === active && "bg-[#f6f2ee]")}
            >
              {s.text}
            </li>
          ))}
          <li aria-hidden className="px-4 pb-1.5 pt-1 text-right text-[11px] text-[#8a7f77]">Powered by Google</li>
        </ul>
      )}
    </div>
  );
};

export default PlacesAutocomplete;
