'use client';

import React, { useEffect } from 'react';

export interface SearchBarProps {
    searchText: string;
    styleClass?: string;
    placeholderText?: string;
    setSearchText: (value: string) => void;
    className?: string;
}

export function SearchBar({
    searchText,
    styleClass = '',
    placeholderText = 'Search',
    setSearchText,
    className = '',
}: SearchBarProps) {
    const updateSearchInput = (value: string) => {
        setSearchText(value);
    };

    return (
        <div className={`inline-block ${styleClass} ${className}`}>
            <div className="input-group relative flex flex-wrap items-stretch w-full">
                <input
                    type="search"
                    value={searchText}
                    placeholder={placeholderText}
                    onChange={(e) => updateSearchInput(e.target.value)}
                    className="input input-sm input-bordered w-full max-w-xs"
                />
            </div>
        </div>
    );
}

