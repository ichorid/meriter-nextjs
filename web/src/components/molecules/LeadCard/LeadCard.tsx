'use client';

import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/shadcn/avatar';
import { User } from 'lucide-react';
import { Badge } from '@/components/atoms/Badge';
import { useTranslations } from 'next-intl';
import { DailyQuotaRing } from '@/components/molecules/DailyQuotaRing';
import { formatMerits } from '@/lib/utils/currency';

interface LeadCardProps {
    id: string;
    displayName: string;
    username?: string;
    avatarUrl?: string | null;
    totalMerits?: number;
    leadCommunities?: string[];
    role?: 'lead' | 'participant' | 'viewer' | 'superadmin';
    showRoleChip?: boolean;
    hideTeamInfo?: boolean;
    onClick?: () => void;
    permanentMerits?: number;
    quota?: {
        dailyQuota: number;
        remainingToday: number;
        usedToday: number;
    };
    hideChevron?: boolean;
}

export const LeadCard: React.FC<LeadCardProps> = ({
    id,
    displayName,
    username,
    avatarUrl,
    totalMerits,
    leadCommunities = [],
    role,
    showRoleChip = false,
    hideTeamInfo = false,
    onClick,
    permanentMerits,
    quota,
    hideChevron = false,
}) => {
    const t = useTranslations('common');
    const tCommon = useTranslations('common');
    const Component = onClick ? 'button' : 'div';

    // Get first team name or empty string
    const teamName = leadCommunities.length > 0 ? leadCommunities[0] : '';
    
    // Format merits display
    const meritsDisplay = totalMerits !== undefined ? formatMerits(totalMerits) : '0';

    // Get role label and variant for badge
    const getRoleBadge = () => {
        if (!role) return null;
        
        const roleLabels: Record<string, string> = {
            lead: t('lead'),
            participant: t('participant'),
            viewer: t('viewer'),
            superadmin: t('superadmin'),
        };

        const roleVariants: Record<string, 'primary' | 'secondary' | 'accent' | 'info' | 'success' | 'warning' | 'error'> = {
            lead: 'secondary',
            participant: 'secondary',
            viewer: 'secondary',
            superadmin: 'error',
        };

        return {
            label: roleLabels[role] || role,
            variant: roleVariants[role] || 'secondary',
        };
    };

    const roleBadge = getRoleBadge();

    return (
        <Component
            className={`
                w-full flex flex-row items-center
                px-5 py-2.5 gap-4
                bg-base-100 border-t border-base-300
                ${onClick ? 'cursor-pointer hover:bg-base-200 active:bg-base-300 transition-colors' : ''}
            `}
            onClick={onClick}
        >
            {/* Avatar */}
            <div className="flex-shrink-0">
                <Avatar className="w-10 h-10 text-sm">
                    {avatarUrl && (
                        <AvatarImage src={avatarUrl} alt={displayName || username || 'User'} />
                    )}
                    <AvatarFallback userId={id} className="font-medium uppercase">
                        {(displayName || username) ? (displayName || username).slice(0, 2).toUpperCase() : <User size={18} />}
                    </AvatarFallback>
                </Avatar>
            </div>

            {/* Info Section */}
            <div className="flex-1 min-w-0 flex flex-col gap-0.5 items-start">
                {/* Name */}
                <div className="text-[15px] font-normal leading-[120%] text-base-content text-left">
                    {displayName || username || 'Unknown User'}
                </div>
                
                {/* Team name */}
                {!hideTeamInfo && teamName && (
                    <div className="text-xs leading-[120%] text-base-content/60 text-left">
                        {tCommon('team')}: "{teamName}"
                    </div>
                )}
                
                {/* Merits info */}
                {totalMerits !== undefined && (
                    <div className="text-xs leading-[120%] text-base-content/60 text-left">
                        {meritsDisplay} merits
                    </div>
                )}
                
                {/* Permanent Merits and Quota */}
                {(permanentMerits !== undefined || quota) && (
                    <div className="flex items-center gap-2 mt-1">
                        {quota && quota.dailyQuota > 0 && (
                            <div className="flex items-center gap-1">
                                <DailyQuotaRing
                                    remaining={quota.remainingToday}
                                    max={quota.dailyQuota}
                                    className="w-4 h-4"
                                    asDiv={true}
                                />
                                <span className="text-xs leading-[120%] text-base-content/60">
                                    {quota.remainingToday}/{quota.dailyQuota}
                                </span>
                            </div>
                        )}
                        {permanentMerits !== undefined && (
                            <div className="flex items-center gap-1 text-xs leading-[120%] text-base-content/60">
                                <span className="font-semibold text-base-content">{formatMerits(permanentMerits)}</span>
                                <span className="text-base-content/60">{t('permanentMerits')}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Chevron */}
            {onClick && !hideChevron && (
                <div className="flex-shrink-0 text-base-content/40">
                    <ChevronRight size={24} />
                </div>
            )}
        </Component>
    );
};

