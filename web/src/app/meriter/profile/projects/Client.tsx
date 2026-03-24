'use client';

import { useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { ProfileTopBar } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { ProfileProjectsTab } from '@/components/organisms/Profile/ProfileProjectsTab';
import { ArchivedProjectCard } from '@/components/organisms/Project/ArchivedProjectCard';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProjects } from '@/hooks/api/useProfile';
import { useProjects } from '@/hooks/api/useProjects';
import { useWallets } from '@/hooks/api';
import { Loader2 } from 'lucide-react';

export default function ProfileProjectsPage() {
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

  const { data: archivedProjectsData } = useProjects({
    projectStatus: 'archived',
    memberId: user?.id ?? undefined,
    page: 1,
    pageSize: 20,
  });

  const [activeWithdrawPost, setActiveWithdrawPost] = useState<string | null>(null);
  const activeCommentHook = useState<string | null>(null);

  const projects = useMemo(() => {
    return (projectsData?.pages ?? []).flatMap((page) => page.data || []);
  }, [projectsData?.pages]);

  const archivedProjects = useMemo(() => archivedProjectsData?.data ?? [], [archivedProjectsData?.data]);

  // Get sort order from URL params, default to 'recent'
  const sortOrder = (() => {
    const sortParam = searchParams?.get('sort');
    return sortParam === 'voted' || sortParam === 'recent' ? sortParam : 'recent';
  })();

  const pageHeader = (
    <ProfileTopBar 
      asStickyHeader={true} 
      title={t('hero.stats.projects')}
      showBack={true}
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
      <div className="space-y-6">
        <ProfileProjectsTab
          projects={projects}
          isLoading={projectsLoading}
          wallets={wallets}
          sortOrder={sortOrder}
          fetchNextPage={fetchNextProjects}
          hasNextPage={hasNextProjects || false}
          isFetchingNextPage={isFetchingNextProjects}
        />
        {archivedProjects.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-lg font-medium">{t('completedProjects', { defaultValue: 'Completed projects' })}</h2>
            <div className="grid gap-3 sm:grid-cols-1">
              {archivedProjects.map((proj: { id: string; name: string; description?: string }) => (
                <ArchivedProjectCard
                  key={proj.id}
                  projectId={proj.id}
                  name={proj.name}
                  description={proj.description}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </AdaptiveLayout>
  );
}



