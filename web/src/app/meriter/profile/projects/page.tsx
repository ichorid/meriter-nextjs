'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProfileProjectsTab } from '@/components/organisms/Profile/ProfileProjectsTab';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProjects } from '@/hooks/api/useProfile';
import { useWallets } from '@/hooks/api';
import { Loader2 } from 'lucide-react';

export default function ProfileProjectsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('profile');
  const { user, isLoading: userLoading, isAuthenticated } = useAuth();
  const { data: wallets = [] } = useWallets();

  const {
    data: projectsData,
    isLoading: projectsLoading,
    fetchNextPage: fetchNextProjects,
    hasNextPage: hasNextProjects,
    isFetchingNextPage: isFetchingNextProjects,
  } = useUserProjects(user?.id || '', 20);

  const [activeWithdrawPost, setActiveWithdrawPost] = useState<string | null>(null);
  const activeCommentHook = useState<string | null>(null);

  const projects = useMemo(() => {
    return (projectsData?.pages ?? []).flatMap((page) => page.data || []);
  }, [projectsData?.pages]);

  // Get sort order from URL params, default to 'recent'
  const sortOrder = (() => {
    const sortParam = searchParams?.get('sort');
    return sortParam === 'voted' || sortParam === 'recent' ? sortParam : 'recent';
  })();

  const pageHeader = (
    <PageHeader
      title={t('tabs.projects')}
      showBack={true}
      onBack={() => router.push('/meriter/profile')}
    />
  );

  if (userLoading || !isAuthenticated) {
    return (
      <AdaptiveLayout className="feed" stickyHeader={pageHeader}>
        <div className="flex flex-1 items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        </div>
      </AdaptiveLayout>
    );
  }

  return (
    <AdaptiveLayout
      className="feed"
      stickyHeader={pageHeader}
      activeCommentHook={activeCommentHook}
      activeWithdrawPost={activeWithdrawPost}
      setActiveWithdrawPost={setActiveWithdrawPost}
      wallets={wallets}
      myId={user?.id}
    >
      <div className="space-y-4">
        <ProfileProjectsTab
          projects={projects}
          isLoading={projectsLoading}
          wallets={wallets}
          sortOrder={sortOrder}
          fetchNextPage={fetchNextProjects}
          hasNextPage={hasNextProjects || false}
          isFetchingNextPage={isFetchingNextProjects}
        />
      </div>
    </AdaptiveLayout>
  );
}



