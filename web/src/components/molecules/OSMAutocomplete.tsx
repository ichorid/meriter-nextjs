"use client";

import React, {
    useState,
    useEffect,
    useRef,
    useCallback,
    useMemo,
} from "react";
import { BrandInput } from "@/components/ui/BrandInput";
import { Loader2, MapPin, AlertCircle, Search } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { useLocale } from "next-intl";

interface OSMAutocompleteProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    type?: "city" | "state" | "country" | "any";
    className?: string;
    error?: string;
    disabled?: boolean;
}

interface NominatimResult {
    place_id: number;
    display_name: string;
    type: string;
    address: {
        city?: string;
        town?: string;
        village?: string;
        hamlet?: string;
        state?: string;
        region?: string;
        country?: string;
        [key: string]: string | undefined;
    };
}

type SearchState = "idle" | "loading" | "success" | "error" | "no-results";

// Simple in-memory cache for API responses
const cache = new Map<string, { data: NominatimResult[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedResults(key: string): NominatimResult[] | null {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }
    cache.delete(key);
    return null;
}

function setCachedResults(key: string, data: NominatimResult[]) {
    cache.set(key, { data, timestamp: Date.now() });
}

export function OSMAutocomplete({
    value,
    onChange,
    placeholder,
    type = "any",
    className,
    error,
    disabled = false,
}: OSMAutocompleteProps) {
    const locale = useLocale();
    const inputId = React.useId();
    const [query, setQuery] = useState(value);
    const [results, setResults] = useState<NominatimResult[]>([]);
    const [searchState, setSearchState] = useState<SearchState>("idle");
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);

    const wrapperRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const debouncedQuery = useDebounce(query, 400);

    // Sync external value changes
    useEffect(() => {
        setQuery(value);
    }, [value]);

    // Click outside handler
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                wrapperRef.current &&
                !wrapperRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
                setHighlightedIndex(-1);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Build cache key
    const cacheKey = useMemo(
        () => `${type}:${locale}:${debouncedQuery.toLowerCase().trim()}`,
        [type, locale, debouncedQuery]
    );

    // Search API
    useEffect(() => {
        // Cancel previous request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        const trimmedQuery = debouncedQuery.trim();

        // Reset if query is too short
        if (!trimmedQuery || trimmedQuery.length < 2 || !isOpen) {
            setResults([]);
            setSearchState("idle");
            return;
        }

        // Check cache first
        const cached = getCachedResults(cacheKey);
        if (cached) {
            setResults(cached);
            setSearchState(cached.length > 0 ? "success" : "no-results");
            return;
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        const searchLocation = async () => {
            setSearchState("loading");

            try {
                // Build optimized query params based on type
                const params = new URLSearchParams({
                    format: "json",
                    addressdetails: "1",
                    limit: "7",
                    "accept-language": locale,
                });

                // Type-specific search optimization
                if (type === "city") {
                    // For cities, use featuretype to get better results
                    params.set("q", trimmedQuery);
                    params.set("featuretype", "city");
                } else if (type === "state") {
                    // For states/regions
                    params.set("q", trimmedQuery);
                    params.set("featuretype", "state");
                } else {
                    params.set("q", trimmedQuery);
                }

                const response = await fetch(
                    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
                    {
                        signal: controller.signal,
                        headers: {
                            Accept: "application/json",
                            "User-Agent": "Meriter-App/1.0",
                        },
                    }
                );

                if (!response.ok) {
                    throw new Error(`API error: ${response.status}`);
                }

                const data: NominatimResult[] = await response.json();

                // Filter results based on type for better relevance
                let filteredData = data;
                if (type === "city") {
                    filteredData = data.filter(
                        (r) =>
                            r.address.city ||
                            r.address.town ||
                            r.address.village ||
                            r.address.hamlet
                    );
                } else if (type === "state") {
                    filteredData = data.filter(
                        (r) => r.address.state || r.address.region
                    );
                }

                // Use original if filter is too aggressive
                const finalData =
                    filteredData.length > 0 ? filteredData : data.slice(0, 5);

                // Cache results
                setCachedResults(cacheKey, finalData);

                setResults(finalData);
                setSearchState(finalData.length > 0 ? "success" : "no-results");
                setHighlightedIndex(-1);
            } catch (err) {
                if (err instanceof Error && err.name === "AbortError") {
                    return; // Ignore aborted requests
                }
                console.error("OSM search error:", err);
                setSearchState("error");
                setResults([]);
            }
        };

        searchLocation();

        return () => {
            controller.abort();
        };
    }, [debouncedQuery, type, isOpen, locale, cacheKey]);

    // Extract display value from result based on type
    const extractValue = useCallback(
        (result: NominatimResult): string => {
            if (type === "city") {
                return (
                    result.address.city ||
                    result.address.town ||
                    result.address.village ||
                    result.address.hamlet ||
                    result.display_name.split(",")[0]
                );
            }
            if (type === "state") {
                return (
                    result.address.state ||
                    result.address.region ||
                    result.display_name.split(",")[0]
                );
            }
            return result.display_name.split(",")[0];
        },
        [type]
    );

    // Format display text for dropdown
    const formatDisplayText = useCallback(
        (result: NominatimResult): { primary: string; secondary: string } => {
            const parts = result.display_name.split(", ");

            if (type === "city") {
                const city =
                    result.address.city ||
                    result.address.town ||
                    result.address.village ||
                    result.address.hamlet ||
                    parts[0];
                const region =
                    result.address.state ||
                    result.address.region ||
                    parts[1] ||
                    "";
                const country = result.address.country || parts[parts.length - 1] || "";
                return {
                    primary: city,
                    secondary: [region, country].filter(Boolean).join(", "),
                };
            }

            if (type === "state") {
                const state =
                    result.address.state || result.address.region || parts[0];
                const country = result.address.country || parts[parts.length - 1] || "";
                return {
                    primary: state,
                    secondary: country,
                };
            }

            return {
                primary: parts[0],
                secondary: parts.slice(1, 3).join(", "),
            };
        },
        [type]
    );

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setQuery(newValue);
        onChange(newValue);
        setIsOpen(true);
        setHighlightedIndex(-1);
    };

    const handleSelectResult = useCallback(
        (result: NominatimResult) => {
            const selection = extractValue(result);
            setQuery(selection);
            onChange(selection);
            setIsOpen(false);
            setResults([]);
            setHighlightedIndex(-1);
        },
        [extractValue, onChange]
    );

    // Keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen || results.length === 0) return;

        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                setHighlightedIndex((prev) =>
                    prev < results.length - 1 ? prev + 1 : 0
                );
                break;
            case "ArrowUp":
                e.preventDefault();
                setHighlightedIndex((prev) =>
                    prev > 0 ? prev - 1 : results.length - 1
                );
                break;
            case "Enter":
                e.preventDefault();
                if (highlightedIndex >= 0 && results[highlightedIndex]) {
                    handleSelectResult(results[highlightedIndex]);
                }
                break;
            case "Escape":
                e.preventDefault();
                setIsOpen(false);
                setHighlightedIndex(-1);
                break;
        }
    };

    // Scroll highlighted item into view
    useEffect(() => {
        if (highlightedIndex >= 0 && listRef.current) {
            const items = listRef.current.querySelectorAll("[role='option']");
            items[highlightedIndex]?.scrollIntoView({ block: "nearest" });
        }
    }, [highlightedIndex]);

    const showDropdown = isOpen && query.length >= 2;

    return (
        <div className={`relative ${className}`} ref={wrapperRef}>
            <BrandInput
                value={query}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                onFocus={() => setIsOpen(true)}
                autoComplete="off"
                name={`osm-search-${inputId}`}
                disabled={disabled}
                role="combobox"
                aria-expanded={showDropdown}
                aria-haspopup="listbox"
                aria-autocomplete="list"
                rightIcon={
                    searchState === "loading" ? (
                        <Loader2 className="w-4 h-4 animate-spin text-base-content/40" />
                    ) : (
                        <Search className="w-4 h-4 text-base-content/30" />
                    )
                }
                error={error}
            />

            {showDropdown && (
                <div
                    ref={listRef}
                    role="listbox"
                    className="absolute z-50 w-full mt-1.5 bg-base-100 border border-base-content/10 rounded-xl shadow-lg max-h-64 overflow-y-auto"
                >
                    {/* Loading state */}
                    {searchState === "loading" && results.length === 0 && (
                        <div className="px-4 py-3 text-sm text-base-content/50 flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Searching...</span>
                        </div>
                    )}

                    {/* Error state */}
                    {searchState === "error" && (
                        <div className="px-4 py-3 text-sm text-error/70 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            <span>Search failed. Try again.</span>
                        </div>
                    )}

                    {/* No results state */}
                    {searchState === "no-results" && (
                        <div className="px-4 py-3 text-sm text-base-content/50 flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            <span>No locations found</span>
                        </div>
                    )}

                    {/* Results */}
                    {results.map((result, index) => {
                        const { primary, secondary } = formatDisplayText(result);
                        const isHighlighted = index === highlightedIndex;

                        return (
                            <button
                                key={result.place_id || index}
                                role="option"
                                aria-selected={isHighlighted}
                                className={`
                                    w-full text-left px-4 py-2.5 flex items-start gap-3 text-sm transition-colors
                                    first:rounded-t-xl last:rounded-b-xl
                                    ${isHighlighted
                                        ? "bg-base-content/5"
                                        : "hover:bg-base-200/50"
                                    }
                                `}
                                onClick={() => handleSelectResult(result)}
                                onMouseEnter={() => setHighlightedIndex(index)}
                            >
                                <MapPin className="w-4 h-4 mt-0.5 text-base-content/30 shrink-0" />
                                <div className="min-w-0 flex-1">
                                    <div className="font-medium text-base-content truncate">
                                        {primary}
                                    </div>
                                    {secondary && (
                                        <div className="text-xs text-base-content/50 truncate mt-0.5">
                                            {secondary}
                                        </div>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
