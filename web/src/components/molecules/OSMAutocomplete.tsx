"use client";

import React, { useState, useEffect, useRef } from "react";
import { BrandInput } from "@/components/ui/BrandInput";
import { Loader2, MapPin } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { useLocale } from "next-intl";

interface OSMAutocompleteProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    type?: "city" | "state" | "country" | "any";
    className?: string;
    error?: string;
}

interface NominatimResult {
    display_name: string;
    address: {
        city?: string;
        town?: string;
        village?: string;
        state?: string;
        country?: string;
        [key: string]: string | undefined;
    };
}

export function OSMAutocomplete({
    value,
    onChange,
    placeholder,
    type = "any",
    className,
    error,
}: OSMAutocompleteProps) {
    const locale = useLocale();
    const inputId = React.useId();
    const [query, setQuery] = useState(value);
    const [results, setResults] = useState<NominatimResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const debouncedQuery = useDebounce(query, 500);

    useEffect(() => {
        setQuery(value);
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                wrapperRef.current &&
                !wrapperRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (!debouncedQuery || debouncedQuery.length < 2 || !isOpen) return;

        const searchLocation = async () => {
            setIsLoading(true);
            try {
                // Refine query based on type to get better results
                let q = debouncedQuery;
                let params = `&q=${encodeURIComponent(q)}`;

                if (type === "city") {
                    params = `&city=${encodeURIComponent(q)}`;
                } else if (type === "state") {
                    params = `&state=${encodeURIComponent(q)}`;
                }

                const response = await fetch(
                    `https://nominatim.openstreetmap.org/search?format=json${params}&addressdetails=1&limit=5&accept-language=${locale}`,
                    {
                        headers: {
                            Accept: "application/json",
                        },
                    }
                );
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                setResults(data);
            } catch (error) {
                console.error("Error searching location:", error);
            } finally {
                setIsLoading(false);
            }
        };

        searchLocation();
    }, [debouncedQuery, type, isOpen, locale]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setQuery(e.target.value);
        onChange(e.target.value); // Allow free text input
        setIsOpen(true);
    };

    const handleSelectResult = (result: NominatimResult) => {
        let selection = result.display_name;

        // Try to extract specific part based on type
        if (type === "city") {
            selection =
                result.address.city ||
                result.address.town ||
                result.address.village ||
                result.address.hamlet ||
                selection;
        } else if (type === "state") {
            selection = result.address.state || selection;
        }

        setQuery(selection);
        onChange(selection);
        setIsOpen(false);
        setResults([]);
    };

    return (
        <div className={`relative ${className}`} ref={wrapperRef}>
            <BrandInput
                value={query}
                onChange={handleInputChange}
                placeholder={placeholder}
                onFocus={() => setIsOpen(true)}
                autoComplete="one-time-code"
                name={`osm-search-${inputId}`}
                rightIcon={
                    isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-base-content/50" />
                    ) : undefined
                }
                error={error}
            />
            {error && <p className="text-error text-xs mt-1">{error}</p>}

            {isOpen && results.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-base-100 border border-base-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {results.map((result, index) => (
                        <button
                            key={index}
                            className="w-full text-left px-4 py-2 hover:bg-base-200 flex items-start space-x-2 text-sm"
                            onClick={() => handleSelectResult(result)}
                        >
                            <MapPin className="w-4 h-4 mt-0.5 text-brand-primary shrink-0" />
                            <span className="truncate">
                                {result.display_name}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
