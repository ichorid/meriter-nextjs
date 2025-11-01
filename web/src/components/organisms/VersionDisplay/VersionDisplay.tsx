'use client';

import React from 'react';
import { useVersion } from '@/hooks/api/useVersion';
import { getFrontendVersion } from '@/lib/utils/version';

export interface VersionDisplayProps {
    className?: string;
    compact?: boolean;
}

/**
 * Display component for showing frontend and backend package versions
 */
export const VersionDisplay: React.FC<VersionDisplayProps> = ({ 
    className = '',
    compact = false 
}) => {
    const { data: versionData, isLoading, isError } = useVersion();
    const frontendVersion = getFrontendVersion();
    const backendVersion = versionData?.version || 'unknown';

    // Don't render if we can't get either version
    if (isError && !versionData) {
        return null;
    }

    const textSize = compact ? 'text-xs' : 'text-sm';
    const spacing = compact ? 'gap-1' : 'gap-2';

    return (
        <div className={`flex items-center ${spacing} ${textSize} text-base-content/60 ${className}`}>
            {isLoading ? (
                <span className="loading loading-spinner loading-xs"></span>
            ) : (
                <>
                    <span>Frontend: v{frontendVersion}</span>
                    <span className="text-base-content/40">|</span>
                    <span>Backend: v{backendVersion}</span>
                </>
            )}
        </div>
    );
};

