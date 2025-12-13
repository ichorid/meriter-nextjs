'use client';

import React from 'react';
import { ChevronRight } from 'lucide-react';
import { BrandAvatar } from '@/components/ui/BrandAvatar';
import { Badge } from '@/components/atoms/Badge';
import { useTranslations } from 'next-intl';

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
}) => {
    const t = useTranslations('common');
    const Component = onClick ? 'button' : 'div';

    // Get first team name or empty string
    const teamName = leadCommunities.length > 0 ? leadCommunities[0] : '';
    
    // Format merits display
    const meritsDisplay = totalMerits !== undefined ? totalMerits.toLocaleString() : '0';

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
            lead: 'primary',
            participant: 'info',
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
                <BrandAvatar
                    src={avatarUrl}
                    fallback={displayName || username || 'User'}
                    size="md"
                    className="w-10 h-10"
                />
            </div>

            {/* Info Section */}
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                {/* Name and Role Chip */}
                <div className="flex items-center gap-2">
                    <div className="text-[15px] font-normal leading-[120%] text-base-content">
                        {displayName || username || 'Unknown User'}
                    </div>
                    {showRoleChip && roleBadge && (
                        <Badge variant={roleBadge.variant} size="xs">
                            {roleBadge.label}
                        </Badge>
                    )}
                </div>
                
                {/* Role text (only show if role chip is not shown) */}
                {!showRoleChip && (
                    <div className="text-xs leading-[120%] text-base-content/60">
                        {t('lead')}
                    </div>
                )}
                
                {/* Team name */}
                {!hideTeamInfo && teamName && (
                    <div className="text-xs leading-[120%] text-base-content/60">
                        {teamName}
                    </div>
                )}
                
                {/* Merits info */}
                {totalMerits !== undefined && (
                    <div className="text-xs leading-[120%] text-base-content/60">
                        {meritsDisplay} merits
                    </div>
                )}
            </div>

            {/* Chevron */}
            {onClick && (
                <div className="flex-shrink-0 text-base-content/40">
                    <ChevronRight size={24} />
                </div>
            )}
        </Component>
    );
};

