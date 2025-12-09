'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { useProfileTabState } from '@/hooks/useProfileTabState';
import { ProfileProjectsTab } from '@/components/organisms/Profile/ProfileProjectsTab';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProjects } from '@/hooks/api/useProfile';
import { useWallets } from '@/hooks/api';
import { Loader2 } from 'lucide-react';

export default function ProfileProjectsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: userLoading, isAuthenticated } = useAuth();
  const { sortByTab, setSortByTab } = useProfileTabState();
  const { data: wallets = [] } = useWallets();

  const {
    data: projectsData,
    isLoading: projectsLoading,
    fetchNextPage: fetchNextProjects,
    hasNextPage: hasNextProjects,
    isFetchingNextPage: isFetchingNextProjects,
  } = useUserProjects(user?.id || '', 20);

  const [activeWithdrawPost, setActiveWithdrawPost] = useState<string | null>(null);
  const [activeSlider, setActiveSlider] = useState<string | null>(null);
  const activeCommentHook = useState<string | null>(null);

  // Flatten projects from all pages
  const projects = useMemo(() => {
    return (projectsData?.pages ?? []).flatMap((page) => page.data || []);
  }, [projectsData?.pages]);

  // Get sort from URL params
  useEffect(() => {
    const sortParam = searchParams?.get('sort');
    if (sortParam === 'voted' || sortParam === 'recent') {
      setSortByTab((prev) => ({
        ...prev,
        projects: sortParam,
      }));
    }
  }, [searchParams, setSortByTab]);

  // Show loading state during auth check
  if (userLoading || !isAuthenticated) {
    return (
      <AdaptiveLayout className="feed">
        <div className="flex flex-1 items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        </div>
      </AdaptiveLayout>
    );
  }

  const sortOrder = sortByTab.projects;

  return (
    <AdaptiveLayout
      activeCommentHook={activeCommentHook}
      activeSlider={activeSlider}
      setActiveSlider={setActiveSlider}
      activeWithdrawPost={activeWithdrawPost}
      setActiveWithdrawPost={setActiveWithdrawPost}
      wallets={wallets}
      myId={user?.id}
    >
      <div className="flex-1 space-y-4">
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


