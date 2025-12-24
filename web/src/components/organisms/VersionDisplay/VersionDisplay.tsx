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
    const { data: versionData, isLoading, _isError } = useVersion();
    const frontendVersion = getFrontendVersion();
    const backendVersion = versionData?.version || (isLoading ? '...' : 'unknown');

    const textSize = compact ? 'text-xs' : 'text-sm';
    const spacing = compact ? 'gap-1' : 'gap-2';

    // Always show frontend version, show backend version if available
    return (
        <div className={`flex items-center ${spacing} ${textSize} text-base-content/70 ${className}`}>
            <span className="whitespace-nowrap">Frontend: v{frontendVersion}</span>
            <span className="text-base-content/40">|</span>
            {isLoading && !versionData ? (
                <span className="whitespace-nowrap">Backend: <span className="loading loading-spinner loading-xs inline-block"></span></span>
            ) : (
                <span className="whitespace-nowrap">Backend: v{backendVersion}</span>
            )}
        </div>
    );
};
