'use client';

import React from 'react';
import Link from 'next/link';
import { Zap, ChevronRight } from 'lucide-react';
import { CommunityAvatar } from '@/shared/components/community-avatar';
import { Badge } from '@/components/atoms';
import { useCommunity } from '@/hooks/api';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/api/useProfile';
import { useTranslations } from 'next-intl';
import { DailyQuotaRing } from '@/components/molecules/DailyQuotaRing';
import { useUserQuota } from '@/hooks/api/useQuota';

export interface CommunityCardProps {
  communityId: string;
  pathname: string | null;
  isExpanded?: boolean;
  hideDescription?: boolean; // Hide description when used in sidebar
  wallet?: {
    balance: number;
    communityId: string;
  };
  quota?: {
    remainingToday: number;
    dailyQuota: number;
  };
}

/**
 * Community card component that displays community info
 * Layout (expanded):
 * - Flex row layout with avatar (46px), content section, and chevron icon
 * - Content section contains: title, merits/quota indicators (conditional), and description
 * - Role badge overlays avatar in top-right corner
 * Used in both the left sidebar and the communities page
 */
export const CommunityCard: React.FC<CommunityCardProps> = ({
  communityId,
  pathname,
  isExpanded = false,
  hideDescription = false,
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
      return { role: 'lead', label: t('lead'), variant: 'accent' as const };
    }
    if (role?.role === 'participant') {
      return { role: 'participant', label: t('participant'), variant: 'info' as const };
    }
    
    return null;
  }, [user?.globalRole, user?.id, userRoles, communityId, t]);

  // Get user's role for this community to check merit rules
  const userRole = React.useMemo(() => {
    if (user?.globalRole === 'superadmin') {
      return 'superadmin';
    }
    const role = userRoles.find(r => r.communityId === communityId);
    return role?.role || null;
  }, [user?.globalRole, userRoles, communityId]);

  // Check if user can earn permanent merits based on community rules
  const canEarnPermanentMerits = React.useMemo(() => {
    if (!community?.meritRules) return false;
    // User can earn permanent merits only if canEarn is true
    return community.meritRules.canEarn === true;
  }, [community?.meritRules]);

  const hasQuota = React.useMemo(() => {
    if (!community?.meritRules || !userRole) return false;
    const { dailyQuota, quotaRecipients } = community.meritRules;
    // User has quota if dailyQuota > 0 and their role is in quotaRecipients
    return dailyQuota > 0 && quotaRecipients?.includes(userRole as any);
  }, [community?.meritRules, userRole]);

  // Fetch quota data for this community
  const { data: quotaData } = useUserQuota(communityId);
  
  // Format balance and quota display
  const balance = wallet?.balance || 0;
  const remainingQuota = quotaData?.remainingToday ?? quota?.remainingToday ?? 0;
  const dailyQuota = quotaData?.dailyQuota ?? quota?.dailyQuota ?? 0;

  // Determine what to show in the subtitle
  const showMerits = canEarnPermanentMerits && wallet && userRole !== 'viewer';
  const showQuota = hasQuota && dailyQuota > 0;
  const showIndicators = showMerits || showQuota;

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
          className={`w-full rounded-lg flex flex-row items-start gap-3 py-3 pr-2 pl-4 cursor-pointer transition-all duration-200 ${
            isActive
              ? 'bg-base-content text-base-100'
              : 'bg-base-200 hover:bg-base-300'
          }`}
        >
          {/* Left section: Avatar + Content */}
          <div className="flex flex-row items-start gap-3 flex-1 min-w-0">
            {/* Avatar section with badge below */}
            <div className="flex flex-col items-start gap-2 flex-shrink-0">
              <CommunityAvatar
                avatarUrl={community.avatarUrl}
                communityName={community.name}
                size={46}
                needsSetup={community.needsSetup}
                className="bg-base-300"
              />
              {userRoleBadge && (
                <Badge 
                  variant={userRoleBadge.variant} 
                  size="xs"
                  className={isActive ? 'bg-base-100/20 text-base-100 border-base-100/20' : ''}
                >
                  {userRoleBadge.label}
                </Badge>
              )}
            </div>

            {/* Content section */}
            <div className="flex flex-col items-start gap-3 flex-1 min-w-0">
              {/* Title section */}
              <div className="flex flex-col items-start gap-1 w-full">
                <div className={`text-[15px] font-semibold leading-[18px] tracking-[0.374px] w-full ${
                  isActive ? 'text-base-100' : 'text-base-content'
                }`}>
                  {community.name}
                </div>
                {/* Merits/Quota indicators */}
                {showIndicators && (
                  <div className="flex flex-row items-center gap-2.5 w-full min-w-0">
                    {showMerits && (
                      <div className="flex items-center gap-1 min-w-0 flex-shrink">
                        {currencyIconUrl && (
                          <img 
                            src={currencyIconUrl} 
                            alt="Currency" 
                            className="w-3 h-3 flex-shrink-0" 
                          />
                        )}
                        <span className={`text-xs leading-[14px] tracking-[0.374px] min-w-0 ${
                          isActive ? 'text-base-100/60' : 'text-base-content/60'
                        }`}>
                          <span className="truncate">{t('permanentMerits')}:</span> <span className={`font-semibold whitespace-nowrap ${
                            isActive ? 'text-base-100' : 'text-base-content'
                          }`}>{balance}</span>
                        </span>
                      </div>
                    )}
                    {showQuota && (
                      <DailyQuotaRing
                        remaining={remainingQuota}
                        max={dailyQuota}
                        className="w-5 h-5 flex-shrink-0"
                        asDiv={true}
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Description */}
              {!hideDescription && community.description && (
                <div className={`text-xs leading-[14px] tracking-[0.374px] line-clamp-2 w-full ${
                  isActive ? 'text-base-100/60' : 'text-base-content/60'
                }`}>
                  {community.description}
                </div>
              )}
            </div>
          </div>

          {/* Right section: Chevron */}
          <div className="flex items-start flex-shrink-0 w-6 h-6">
            <ChevronRight 
              className={`w-6 h-6 ${
                isActive ? 'text-base-100/60' : 'text-base-content/60'
              }`} 
            />
          </div>
        </div>
      </Link>
    );
  }

  // Collapsed version (tablet/mobile)
  return (
    <Link href={`/meriter/communities/${communityId}`}>
      <div className="flex flex-col items-center relative py-1">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer overflow-hidden ${
            isActive
              ? 'ring-2 ring-base-content ring-offset-2 ring-offset-base-100'
              : 'hover:ring-2 hover:ring-base-content/10'
          }`}
        >
          <CommunityAvatar
            avatarUrl={community.avatarUrl}
            communityName={community.name}
            size={44}
            needsSetup={community.needsSetup}
          />
        </div>
        {userRoleBadge && (
          <div 
            className={`absolute top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-base-100 ${
              userRoleBadge.variant === 'error' ? 'bg-error' :
              userRoleBadge.variant === 'accent' ? 'bg-accent' :
              userRoleBadge.variant === 'info' ? 'bg-info' : 'bg-accent'
            }`} 
            title={userRoleBadge.label} 
          />
        )}
        {(showMerits || showQuota) && (
          <div className="mt-2 px-1.5 py-1 rounded-lg bg-base-200/50 flex items-center justify-center gap-2">
            {showMerits && (
              <div className="text-[9px] leading-none text-base-content/50 flex items-center gap-0.5 justify-center">
                {currencyIconUrl && (
                  <img src={currencyIconUrl} alt="" className="w-2 h-2 flex-shrink-0 opacity-60" />
                )}
                <span className="font-medium text-base-content/70">{balance}</span>
              </div>
            )}
            {showQuota && (
              <DailyQuotaRing
                remaining={remainingQuota}
                max={dailyQuota}
                className="w-4 h-4 flex-shrink-0"
                asDiv={true}
              />
            )}
          </div>
        )}
      </div>
    </Link>
  );
};

