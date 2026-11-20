import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AddressData {
  address: string;
  city: string;
  zipCode: string;
  country: string;
  addressLabel: string;
  cityCode: string;
  banId: string;
  latitude: number;
  longitude: number;
}

interface AddressAutocompleteProps {
  value?: string;
  onChange: (data: AddressData) => void;
  onRawChange?: (rawText: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

interface BANFeature {
  geometry: {
    coordinates: [number, number]; // [lon, lat]
  };
  properties: {
    id: string;
    label: string;
    name?: string;
    postcode: string;
    citycode: string;
    city: string;
    context?: string;
    type?: string;
  };
}

export const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  value = "",
  onChange,
  onRawChange,
  placeholder = "Rechercher une adresse en France (IGN BAN)...",
  className,
  disabled = false,
}) => {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<BANFeature[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchSuggestions = async (searchQuery: string) => {
    if (!searchQuery || searchQuery.trim().length < 3) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const url = `https://data.geopf.fr/geocodage/search/?q=${encodeURIComponent(
        searchQuery.trim()
      )}&autocomplete=1&limit=5`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`BAN API status: ${res.status}`);
      }
      const data = await res.json();
      if (data && Array.isArray(data.features)) {
        setSuggestions(data.features);
        setIsOpen(data.features.length > 0);
      } else {
        setSuggestions([]);
        setIsOpen(false);
      }
    } catch (err) {
      console.warn("[AddressAutocomplete] BAN query error:", err);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setSelectedIndex(-1);
    if (onRawChange) {
      onRawChange(val);
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      fetchSuggestions(val);
    }, 300);
  };

  const handleSelect = (feature: BANFeature) => {
    const coords = feature.geometry.coordinates; // [lon, lat]
    const p = feature.properties;
    setQuery(p.label);
    setIsOpen(false);
    setSuggestions([]);

    onChange({
      address: p.name || p.label,
      city: p.city || "",
      zipCode: p.postcode || "",
      country: "France",
      addressLabel: p.label,
      cityCode: p.citycode || "",
      banId: p.id || "",
      longitude: coords[0],
      latitude: coords[1],
    });
  };

  const handleClear = () => {
    setQuery("");
    setSuggestions([]);
    setIsOpen(false);
    if (onRawChange) onRawChange("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[selectedIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="pl-9 pr-9"
          autoComplete="off"
        />
        {isLoading ? (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        ) : query ? (
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          {suggestions.map((feature, idx) => (
            <li
              key={feature.properties.id || `${feature.properties.label}-${idx}`}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(feature);
              }}
              className={cn(
                "flex flex-col px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground border-b last:border-b-0",
                selectedIndex === idx && "bg-accent text-accent-foreground font-medium"
              )}
            >
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="font-medium text-foreground">{feature.properties.name || feature.properties.label}</span>
              </div>
              <span className="text-xs text-muted-foreground ml-5">
                {feature.properties.postcode} {feature.properties.city}
                {feature.properties.context ? ` (${feature.properties.context})` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
