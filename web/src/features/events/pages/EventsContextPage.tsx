'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { useAuth } from '@/contexts/AuthContext';
import { useCommunity } from '@/hooks/api';
import { useUserRoles } from '@/hooks/api/useProfile';
import { EventsFeed } from '../components/EventsFeed';
import { canUserCreateEvents, isCommunityMemberRole } from '../lib/event-permissions';
import type { EventCreationMode } from '../lib/event-permissions';

export interface EventsContextPageProps {
  communityId: string;
  backHref: string;
  /** No layout / login redirect — used inside community hub tabs. */
  variant?: 'page' | 'embedded';
  /** Passed to `EventsFeed` — client-side title/description filter. */
  listTitleSearch?: string;
  /** Hub renders «New event» in the chrome toolbar. */
  hideNewEventButton?: boolean;
  createDialogOpen?: boolean;
  onCreateDialogOpenChange?: (open: boolean) => void;
  /**
   * Project hub: membership from project APIs (`useProjectMembers`), not `userRoles` keyed by project id.
   * When set, «New event» visibility uses this (plus superadmin) together with `canUserCreateEvents`.
   */
  projectMemberForEvents?: boolean;
}

export function EventsContextPage({
  communityId,
  backHref,
  variant = 'page',
  listTitleSearch = '',
  hideNewEventButton = false,
  createDialogOpen,
  onCreateDialogOpenChange,
  projectMemberForEvents,
}: EventsContextPageProps) {
  const router = useRouter();
  const t = useTranslations('events');
  const tCommon = useTranslations('common');
  const { user, isLoading: authLoading } = useAuth();
  const { data: community, isLoading: communityLoading } = useCommunity(communityId);
  const { data: userRoles = [] } = useUserRoles(user?.id || '');

  useEffect(() => {
    if (variant === 'embedded') return;
    if (!authLoading && !user?.id) {
      router.push('/meriter/login?returnTo=' + encodeURIComponent(window.location.pathname));
    }
  }, [authLoading, user, router, variant]);

  const eventCreation = (community?.settings as { eventCreation?: EventCreationMode } | undefined)
    ?.eventCreation;

  const isMember = useMemo(
    () => (user?.id ? isCommunityMemberRole(communityId, userRoles) : false),
    [user?.id, communityId, userRoles],
  );

  const canCreateEvents = useMemo(
    () =>
      user?.id
        ? canUserCreateEvents(eventCreation, {
            communityId,
            userRoles,
            isSuperadmin: user.globalRole === 'superadmin',
          })
        : false,
    [user, eventCreation, communityId, userRoles],
  );

  const memberForEventCreateCta = useMemo(() => {
    if (!user?.id) return false;
    if (user.globalRole === 'superadmin') return true;
    if (projectMemberForEvents !== undefined) return Boolean(projectMemberForEvents);
    return isCommunityMemberRole(communityId, userRoles);
  }, [user?.id, user?.globalRole, projectMemberForEvents, communityId, userRoles]);

  const showCreateEventToolbar = Boolean(canCreateEvents && memberForEventCreateCta);

  const pageHeader = (
    <SimpleStickyHeader
      title={t('feedTitle')}
      showBack
      onBack={() => router.push(backHref)}
      asStickyHeader
      showScrollToTop
    />
  );

  if (authLoading || communityLoading) {
    if (variant === 'embedded') {
      return (
        <div className="flex min-h-[160px] items-center justify-center py-6">
          <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
        </div>
      );
    }
    return (
      <AdaptiveLayout className="feed" communityId={communityId} myId={user?.id} stickyHeader={pageHeader}>
        <div className="flex min-h-[240px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
        </div>
      </AdaptiveLayout>
    );
  }

  if (!community) {
    if (variant === 'embedded') {
      return <p className="text-sm text-base-content/70">{tCommon('error')}</p>;
    }
    return (
      <AdaptiveLayout className="feed" communityId={communityId} myId={user?.id} stickyHeader={pageHeader}>
        <p className="text-sm text-base-content/70">{tCommon('error')}</p>
      </AdaptiveLayout>
    );
  }

  const feed = (
    <div className={variant === 'embedded' ? 'mx-auto w-full max-w-4xl pb-8' : 'mx-auto max-w-4xl px-4 pb-24'}>
      <EventsFeed
        communityId={communityId}
        isMember={isMember}
        canCreateEvents={canCreateEvents}
        showCreateEventToolbar={showCreateEventToolbar}
        titleSearch={listTitleSearch}
        hideNewEventButton={hideNewEventButton}
        createDialogOpen={createDialogOpen}
        onCreateDialogOpenChange={onCreateDialogOpenChange}
      />
    </div>
  );

  if (variant === 'embedded') {
    return feed;
  }

  return (
    <AdaptiveLayout className="feed" communityId={communityId} myId={user?.id} stickyHeader={pageHeader}>
      {feed}
    </AdaptiveLayout>
  );
}
