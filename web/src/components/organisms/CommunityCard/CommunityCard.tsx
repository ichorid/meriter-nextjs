'use client';

import React from 'react';
import Link from 'next/link';
import { CommunityAvatar } from '@/shared/components/community-avatar';
import { Badge } from '@/components/atoms';
import { useCommunity } from '@/hooks/api';
import { useWallets } from '@/hooks/api';
import { useAuth } from '@/contexts/AuthContext';
import { useCommunityQuotas } from '@/hooks/api/useCommunityQuota';
import { useUserRoles } from '@/hooks/api/useProfile';
import { useTranslations } from 'next-intl';

export interface CommunityCardProps {
  communityId: string;
  pathname: string | null;
  isExpanded?: boolean;
  wallet?: {
    balance: number;
    communityId: string;
  };
  quota?: {
    remainingToday: number;
  };
}

/**
 * Community card component that displays community info horizontally
 * Shows: avatar, title, and balance/quota in emoji: X+Y format
 */
export const CommunityCard: React.FC<CommunityCardProps> = ({
  communityId,
  pathname,
  isExpanded = false,
  wallet,
  quota,
}) => {
  const { data: community } = useCommunity(communityId);
  const { user } = useAuth();
  const { data: userRoles = [] } = useUserRoles(user?.id || '');
  const t = useTranslations('common');
  const isActive = pathname?.includes(`/communities/${communityId}`);

  // Determine user's role per community for badge display
  const userRoleBadge = React.useMemo(() => {
    // Check global superadmin role first
    if (user?.globalRole === 'superadmin') {
      return { role: 'superadmin', label: t('superadmin'), variant: 'error' as const };
    }
    
    // Find role in userRoles array matching the communityId
    const role = userRoles.find(r => r.communityId === communityId);
    
    // Only show badge for lead, participant, and superadmin (not viewer)
    if (role?.role === 'lead') {
      return { role: 'lead', label: t('representative'), variant: 'accent' as const };
    }
    if (role?.role === 'participant') {
      return { role: 'participant', label: t('participant'), variant: 'info' as const };
    }
    
    return null;
  }, [user?.globalRole, user?.id, userRoles, communityId, t]);

  // Format balance and quota display
  const balance = wallet?.balance || 0;
  const remainingQuota = quota?.remainingToday || 0;

  // Show a placeholder while loading or if community fetch fails
  if (!community) {
    // Still render something so we can see if the issue is with community fetching
    return (
      <div className={`w-full rounded-lg p-3 flex items-center gap-3 ${isExpanded ? '' : 'w-12 h-12'}`}>
        {isExpanded ? (
          <div className="flex-1">
            <div className="text-sm font-medium truncate text-base-content/50">
              Loading {communityId}...
            </div>
          </div>
        ) : (
          <div className="w-12 h-12 rounded-full bg-base-300 animate-pulse" />
        )}
      </div>
    );
  }
  
  // Get currency icon from community settings (stored as data URL or image URL)
  const currencyIconUrl = community.settings?.iconUrl;

  // Expanded version (desktop)
  if (isExpanded) {
    return (
      <Link href={`/meriter/communities/${communityId}`}>
        <div
          className={`w-full rounded-lg p-3 flex items-center gap-3 cursor-pointer transition-all ${
            isActive
              ? 'bg-primary text-primary-content'
              : 'bg-base-100 hover:bg-base-200 border border-base-300'
          }`}
        >
          <div className="flex-shrink-0">
            <CommunityAvatar
              avatarUrl={community.avatarUrl}
              communityName={community.name}
              size={40}
              needsSetup={community.needsSetup}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <div className={`text-sm font-medium truncate ${isActive ? 'text-primary-content' : 'text-base-content dark:text-base-content'}`}>
                {community.name}
              </div>
              {userRoleBadge && (
                <Badge 
                  variant={userRoleBadge.variant} 
                  size="xs"
                  className={isActive ? 'bg-primary-content/20 text-primary-content border border-primary-content/30' : ''}
                >
                  {userRoleBadge.label}
                </Badge>
              )}
            </div>
            <div className={`text-xs truncate flex items-center gap-1 ${isActive ? 'text-primary-content/80' : 'text-base-content/60 dark:text-base-content/60'}`}>
              {currencyIconUrl && (
                <img src={currencyIconUrl} alt="Currency" className="w-3 h-3 inline-block" />
              )}
              <span>{balance}+{remainingQuota}</span>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  // Collapsed version (tablet/mobile - avatar only with compact metrics below)
  return (
    <Link href={`/meriter/communities/${communityId}`}>
      <div className="w-12 flex flex-col items-center relative">
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer ${
            isActive
              ? 'ring-2 ring-primary ring-offset-2 ring-offset-base-200'
              : 'hover:ring-2 hover:ring-base-content/20'
          }`}
        >
          <CommunityAvatar
            avatarUrl={community.avatarUrl}
            communityName={community.name}
            size={48}
            needsSetup={community.needsSetup}
          />
        </div>
        {userRoleBadge && (
          <div 
            className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-base-200 ${
              userRoleBadge.variant === 'error' ? 'bg-error' :
              userRoleBadge.variant === 'accent' ? 'bg-accent' :
              userRoleBadge.variant === 'info' ? 'bg-info' : 'bg-accent'
            }`} 
            title={userRoleBadge.label} 
          />
        )}
        <div className="mt-1 text-[10px] leading-none text-base-content/60 text-center truncate max-w-[48px] flex items-center justify-center gap-0.5">
          {currencyIconUrl && (
            <img src={currencyIconUrl} alt="Currency" className="w-2.5 h-2.5 inline-block" />
          )}
          <span>{balance}+{remainingQuota}</span>
        </div>
      </div>
    </Link>
  );
};

