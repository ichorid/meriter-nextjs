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
}

export function EventsContextPage({ communityId, backHref }: EventsContextPageProps) {
  const router = useRouter();
  const t = useTranslations('events');
  const tCommon = useTranslations('common');
  const { user, isLoading: authLoading } = useAuth();
  const { data: community, isLoading: communityLoading } = useCommunity(communityId);
  const { data: userRoles = [] } = useUserRoles(user?.id || '');

  useEffect(() => {
    if (!authLoading && !user?.id) {
      router.push('/meriter/login?returnTo=' + encodeURIComponent(window.location.pathname));
    }
  }, [authLoading, user, router]);

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
    return (
      <AdaptiveLayout className="feed" communityId={communityId} myId={user?.id} stickyHeader={pageHeader}>
        <div className="flex min-h-[240px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
        </div>
      </AdaptiveLayout>
    );
  }

  if (!community) {
    return (
      <AdaptiveLayout className="feed" communityId={communityId} myId={user?.id} stickyHeader={pageHeader}>
        <p className="text-sm text-base-content/70">{tCommon('error')}</p>
      </AdaptiveLayout>
    );
  }

  return (
    <AdaptiveLayout className="feed" communityId={communityId} myId={user?.id} stickyHeader={pageHeader}>
      <div className="mx-auto max-w-4xl px-4 pb-24">
        <EventsFeed communityId={communityId} isMember={isMember} canCreateEvents={canCreateEvents} />
      </div>
    </AdaptiveLayout>
  );
}
