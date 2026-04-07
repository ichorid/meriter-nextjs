'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { CommunityAvatar } from '@/shared/components/community-avatar';
import { useCommunity } from '@/hooks/api';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/api/useProfile';
import { useTranslations } from 'next-intl';
import { DailyQuotaRing } from '@/components/molecules/DailyQuotaRing';
import { useUserQuota } from '@/hooks/api/useQuota';
import { formatMerits } from '@/lib/utils/currency';

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
  const tCommunities = useTranslations('communities');
  const tProjects = useTranslations('projects');
  const isActive = community?.isProject
    ? pathname === `/meriter/projects/${communityId}` || pathname?.startsWith(`/meriter/projects/${communityId}/`)
    : pathname?.includes(`/communities/${communityId}`);

  // Community-scoped role only — global superadmin is not a member unless they have lead/participant here
  const userRole = React.useMemo(() => {
    const role = userRoles.find((r) => r.communityId === communityId);
    return role?.role ?? null;
  }, [userRoles, communityId]);

  // Check if user can earn permanent merits based on community rules
  const canEarnPermanentMerits = React.useMemo(() => {
    if (!community?.meritSettings) return false;
    // User can earn permanent merits only if canEarn is true
    return community.meritSettings.canEarn === true;
  }, [community?.meritSettings]);

  const hasQuota = React.useMemo(() => {
    if (!community?.meritSettings || !userRole) return false;
    const { dailyQuota, quotaRecipients, quotaEnabled } = community.meritSettings;
    // User has quota if quotaEnabled is true, dailyQuota > 0 and their role is in quotaRecipients
    return quotaEnabled !== false && dailyQuota > 0 && quotaRecipients.includes(userRole);
  }, [community?.meritSettings, userRole]);

  // Check if it's marathon-of-good
  const isMarathonOfGood = community?.typeTag === 'marathon-of-good';

  // Only fetch quota when no prop supplied (avoids N+1 when parent already batch-fetched)
  const { data: quotaData } = useUserQuota(quota ? undefined : communityId);

  // Format balance and quota display (merits rounded to tenths)
  const balanceRaw = wallet?.balance || 0;
  const balance = formatMerits(balanceRaw);
  const remainingQuota = quota?.remainingToday ?? quotaData?.remainingToday ?? 0;
  const dailyQuota = quota?.dailyQuota ?? quotaData?.dailyQuota ?? 0;

  const hasMembershipRole = userRole === 'lead' || userRole === 'participant';

  // Determine what to show in the subtitle (wallet rows only for real members)
  const showMerits = canEarnPermanentMerits && wallet && hasMembershipRole;
  const showQuota = hasQuota && dailyQuota > 0 && hasMembershipRole;
  const showIndicators = showMerits || showQuota;

  // Show a placeholder while loading or if community fetch fails
  if (!community) {
    // Still render something so we can see if the issue is with community fetching
    return (
      <div className={`w-full rounded-lg p-3 flex items-center gap-3 ${isExpanded ? '' : 'w-12 h-12'}`}>
        {isExpanded ? (
          <div className="flex-1">
            <div className="text-sm font-medium truncate text-base-content/50">
              {t('loading')} {communityId}...
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

  // Get cover image from community
  const coverImageUrl = community.coverImageUrl;
  const hasCover = !!coverImageUrl;

  const href = community.isProject ? `/meriter/projects/${communityId}` : `/meriter/communities/${communityId}`;

  // Expanded version (desktop)
  if (isExpanded) {
    return (
      <Link href={href}>
        <div
          className={`w-full min-w-0 rounded-xl flex flex-row items-start gap-3 py-3 pr-2 pl-4 cursor-pointer transition-all duration-200 overflow-visible relative ${isActive
            ? 'shadow-[0_8px_16px_rgba(0,0,0,0.15)] -translate-y-0.5 scale-[1.01]'
            : ''
            } ${!isActive && !hasCover ? 'bg-base-200 hover:bg-base-300' : ''} ${isActive && !hasCover ? 'bg-base-300' : ''}`}
          style={hasCover ? {
            backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.7), rgba(0,0,0,0.4)), url(${coverImageUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          } : undefined}
        >
          {/* Left section: Avatar + Content */}
          <div className="flex flex-row items-start gap-3 flex-1 min-w-0 relative">
            {/* Avatar + quota on top-right */}
            <div className={`flex flex-col items-start gap-2 flex-shrink-0 relative ${!showIndicators && hideDescription ? 'self-center' : ''}`}>
              <div className="relative">
                <CommunityAvatar
                  avatarUrl={community.avatarUrl}
                  communityName={community.name}
                  communityId={community.id}
                  size={46}
                  needsSetup={community.needsSetup}
                  className="bg-base-300"
                />
                {/* Quota counter on top-right corner of avatar */}
                {showQuota && (
                  <div className="absolute -top-2 z-10 bg-base-200 rounded-full p-0.5" style={{ transform: 'scale(0.76)', right: '-8px' }}>
                    <DailyQuotaRing
                      remaining={remainingQuota}
                      max={dailyQuota}
                      className="w-5 h-5 flex-shrink-0"
                      asDiv={true}
                      variant={isMarathonOfGood ? 'golden' : 'default'}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Content section */}
            <div className={`flex flex-col items-start flex-1 min-w-0 ${!showIndicators && hideDescription ? 'self-center' : ''}`}>
              {/* Title section */}
              <div className="flex flex-col items-start w-full">
                <div className={`text-[15px] font-semibold leading-[18px] tracking-[0.374px] w-full ${hasCover ? 'text-white drop-shadow' : 'text-base-content'
                  }`}>
                  {community.name}
                </div>
                {community.isProject && community.isPersonalProject === true && (
                  <span
                    className={`text-[11px] font-medium uppercase tracking-wide mt-0.5 ${hasCover ? 'text-white/70' : 'text-base-content/50'}`}
                  >
                    {tProjects('personalProject')}
                  </span>
                )}
                {/* Merits indicator - right below name */}
                {showMerits && (
                  <div className="flex items-center gap-1 min-w-0 flex-shrink mt-0.5">
                    <span className={`text-[11px] leading-[14px] tracking-[0.374px] min-w-0 ${hasCover ? 'text-white/70' : 'text-base-content/60'
                      }`}>
                      {t('yourMerits')}:{' '}
                    </span>
                    <span className={`text-xs font-medium whitespace-nowrap ${hasCover ? 'text-white/80' : 'text-base-content/70'
                      }`}>{balance}</span>
                    {currencyIconUrl && (
                      <img
                        src={currencyIconUrl}
                        alt={tCommunities('currency')}
                        className="w-2.5 h-2.5 flex-shrink-0"
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Description */}
              {!hideDescription && community.description && (
                <div className={`text-xs leading-[14px] tracking-[0.374px] w-full mt-4 ${hasCover ? 'text-white/70' : 'text-base-content/60'
                  }`}>
                  {community.description}
                </div>
              )}
            </div>
          </div>

          {/* Right section: Chevron */}
          <div className={`flex items-start flex-shrink-0 w-6 h-6 ${!showIndicators && hideDescription ? 'self-center' : ''}`}>
            <ChevronRight
              className={`w-6 h-6 ${hasCover ? 'text-white/60' : 'text-base-content/60'
                }`}
            />
          </div>
        </div>
      </Link>
    );
  }

  // Collapsed version (tablet/mobile)
  return (
    <Link href={href}>
      <div className="flex flex-col items-center relative py-1">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer overflow-hidden ${isActive
            ? 'ring-2 ring-base-content ring-offset-2 ring-offset-base-100'
            : 'hover:ring-2 hover:ring-base-content/10'
            }`}
        >
          <CommunityAvatar
            avatarUrl={community.avatarUrl}
            communityName={community.name}
            communityId={community.id}
            size={44}
            needsSetup={community.needsSetup}
          />
        </div>
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
                variant={isMarathonOfGood ? 'golden' : 'default'}
              />
            )}
          </div>
        )}
      </div>
    </Link>
  );
};

