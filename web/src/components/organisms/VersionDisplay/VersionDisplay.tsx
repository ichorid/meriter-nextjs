'use client';

import React from 'react';
import { useVersion } from '@/hooks/api/useVersion';
import {
    getFrontendBuildSha,
    getFrontendPackageVersions,
    getFrontendVersion,
} from '@/lib/utils/version';

export interface VersionDisplayProps {
    className?: string;
    compact?: boolean;
    showBuildInfo?: boolean;
}

/**
 * Display component for showing frontend and backend package versions
 */
export const VersionDisplay: React.FC<VersionDisplayProps> = ({ 
    className = '',
    compact = false,
    showBuildInfo = false,
}) => {
    const { data: versionData, isLoading } = useVersion();
    const frontendVersion = getFrontendVersion();
    const frontendSha = getFrontendBuildSha();
    const packageVersions = getFrontendPackageVersions();
    const backendVersion = versionData?.version || (isLoading ? '...' : 'unknown');

    const textSize = compact ? 'text-xs' : 'text-sm';
    const spacing = compact ? 'gap-1' : 'gap-2';

    // Always show frontend version, show backend version if available
    return (
        <div className={`flex flex-col ${textSize} text-base-content/70 ${className}`}>
            <div className={`flex items-center ${spacing}`}>
                <span className="whitespace-nowrap">Frontend: v{frontendVersion}</span>
                {showBuildInfo && (
                    <span className="whitespace-nowrap text-base-content/50">(sha: {frontendSha})</span>
                )}
                <span className="text-base-content/40">|</span>
                {isLoading && !versionData ? (
                    <span className="whitespace-nowrap">Backend: <span className="loading loading-spinner loading-xs inline-block"></span></span>
                ) : (
                    <span className="whitespace-nowrap">Backend: v{backendVersion}</span>
                )}
            </div>

            {showBuildInfo && (
                <div className="mt-1 text-[11px] leading-snug text-base-content/50">
                    <span className="whitespace-nowrap">next {packageVersions.next}</span>,{' '}
                    <span className="whitespace-nowrap">react {packageVersions.react}</span>,{' '}
                    <span className="whitespace-nowrap">rq {packageVersions['@tanstack/react-query']}</span>,{' '}
                    <span className="whitespace-nowrap">trpc {packageVersions['@trpc/client']}</span>,{' '}
                    <span className="whitespace-nowrap">axios {packageVersions.axios}</span>
                </div>
            )}
        </div>
    );
};

