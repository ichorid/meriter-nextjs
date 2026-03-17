'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { routes } from '@/lib/constants/routes';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';

interface CommunityProjectsPageClientProps {
  communityId: string;
}

/**
 * Placeholder for community projects list. TODO: replace with real list when API is available.
 */
export function CommunityProjectsPageClient({ communityId }: CommunityProjectsPageClientProps) {
  const router = useRouter();
  const tCommunities = useTranslations('pages.communities');
  const { user } = useAuth();

  const pageHeader = (
    <SimpleStickyHeader
      title={tCommunities('communityProjects')}
      showBack
      onBack={() => router.push(routes.community(communityId))}
      asStickyHeader
      showScrollToTop={false}
    />
  );

  return (
    <AdaptiveLayout
      className="community-projects"
      communityId={communityId}
      myId={user?.id}
      stickyHeader={pageHeader}
    >
      <div className="p-4 text-base-content/70 text-sm">
        {tCommunities('communityProjects')} — {tCommunities('comingSoon')}.
      </div>
    </AdaptiveLayout>
  );
}
