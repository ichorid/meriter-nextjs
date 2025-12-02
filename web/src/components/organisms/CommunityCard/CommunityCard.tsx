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
  const isActive = pathname?.includes(`/communities/${communityId}`);

  // Check if user is a lead in this community
  const isLead = React.useMemo(() => {
    if (user?.globalRole === 'superadmin') return true;
    const role = userRoles.find(r => r.communityId === communityId);
    return role?.role === 'lead' || community?.adminIds?.includes(user?.id || '');
  }, [user?.globalRole, user?.id, userRoles, communityId, community?.adminIds]);

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
              {isLead && (
                <Badge variant="accent" size="xs">
                  Lead
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
        {isLead && (
          <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-accent border-2 border-base-200" title="Lead" />
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

