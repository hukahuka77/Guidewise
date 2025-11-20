import React from "react";
import { Button } from "@/components/ui/button";

export interface QuickSuggestion {
  field: string;
  label: string;
  value: string;
}

interface QuickSuggestionsProps {
  suggestions: QuickSuggestion[];
  selectedValues: Record<string, string>;
  onChange: (field: string, value: string) => void;
}

export default function QuickSuggestions({ suggestions, selectedValues, onChange }: QuickSuggestionsProps) {
  const handleToggle = (suggestion: QuickSuggestion) => {
    // If already selected, clear it; otherwise set the suggested value
    const currentValue = selectedValues[suggestion.field];
    if (currentValue) {
      onChange(suggestion.field, "");
    } else {
      onChange(suggestion.field, suggestion.value);
    }
  };

  return (
    <div className="mb-4 flex flex-col items-center">
      <div className="flex flex-wrap justify-center gap-2 mb-2">
        {suggestions.map((suggestion) => {
          const isSelected = Boolean(selectedValues[suggestion.field]);
          return (
            <Button
              key={suggestion.field}
              type="button"
              onClick={() => handleToggle(suggestion)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-[oklch(0.6923_0.22_21.05)] text-white border border-[oklch(0.6923_0.22_21.05)] hover:opacity-90'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-[oklch(0.6923_0.22_21.05)]'
              }`}
            >
              {isSelected ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                  </svg>
                  {suggestion.label}
                </>
              ) : (
                `+ ${suggestion.label}`
              )}
            </Button>
          );
        })}
      </div>
      <p className="text-sm text-gray-400 italic">Quick add suggestions</p>
    </div>
  );
}
