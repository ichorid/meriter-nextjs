'use client';
import React, { useState, useEffect, _useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Input } from '@/components/ui/shadcn/input';
import { Search, MapPin, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

const Map = dynamic(() => import('./Map'), {
    ssr: false,
    loading: () => <div className="h-64 w-full bg-base-200 animate-pulse rounded-xl flex items-center justify-center text-base-content/50">Loading map...</div>,
});

interface LocationPickerProps {
    initialRegion?: string;
    initialCity?: string;
    onLocationSelect: (location: { region: string; city: string }) => void;
}

interface NominatimResult {
    lat: string;
    lon: string;
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

export function LocationPicker({ initialRegion, initialCity, onLocationSelect }: LocationPickerProps) {
    const _t = useTranslations('common');
    const tSearch = useTranslations('search');
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<NominatimResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [center, setCenter] = useState<[number, number]>([55.7558, 37.6173]); // Default Moscow
    const [zoom, setZoom] = useState(10);
    const [showMap, setShowMap] = useState(false);

    // Initialize query from props if available
    useEffect(() => {
        if (initialCity || initialRegion) {
            const parts = [initialCity, initialRegion].filter(Boolean);
            if (parts.length > 0) {
                setQuery(parts.join(', '));
                // Optionally try to geocode this to set map center
            }
        }
    }, []);

    const searchLocation = async (q: string) => {
        if (!q) return;
        setIsLoading(true);
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&addressdetails=1&limit=5`);
            const data = await response.json();
            setResults(data);
        } catch {
            console.error('Error searching location:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSearch = () => {
        searchLocation(query);
        setShowMap(true);
    };

    const handleSelectResult = (result: NominatimResult) => {
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);
        setCenter([lat, lon]);
        setZoom(13);
        setResults([]);

        const city = result.address.city || result.address.town || result.address.village || '';
        const region = result.address.state || result.address.country || '';

        setQuery(result.display_name);
        onLocationSelect({ region, city });
    };

    const handleMapClick = async (lat: number, lng: number) => {
        setCenter([lat, lng]);
        setIsLoading(true);
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`);
            const data = await response.json();

            const city = data.address.city || data.address.town || data.address.village || '';
            const region = data.address.state || data.address.country || '';

            setQuery(data.display_name);
            onLocationSelect({ region, city });
        } catch {
            console.error('Error reverse geocoding:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="relative">
                <div className="relative">
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={tSearch('results.searchLocationPlaceholder')}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        className={cn('h-11 rounded-xl pr-10', isLoading && 'pr-10')}
                    />
                    {isLoading ? (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none z-10">
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={handleSearch}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-base-200 rounded-full transition-colors z-10"
                            disabled={isLoading}
                        >
                            <Search className="w-4 h-4 text-muted-foreground" />
                        </button>
                    )}
                </div>

                {results.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-base-100 border border-base-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {results.map((result, index) => (
                            <button
                                key={index}
                                className="w-full text-left px-4 py-2 hover:bg-base-200 flex items-start space-x-2 text-sm"
                                onClick={() => handleSelectResult(result)}
                            >
                                <MapPin className="w-4 h-4 mt-0.5 text-brand-primary shrink-0" />
                                <span className="truncate">{result.display_name}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="h-64 w-full rounded-xl overflow-hidden border border-base-300 relative">
                <Map
                    center={center}
                    zoom={zoom}
                    onLocationSelect={handleMapClick}
                />
                {!showMap && !initialCity && !initialRegion && (
                    <div className="absolute inset-0 bg-base-200/80 flex items-center justify-center z-[400]">
                        <p className="text-base-content/60 text-sm">Search for a location to view on map</p>
                    </div>
                )}
            </div>
        </div>
    );
}