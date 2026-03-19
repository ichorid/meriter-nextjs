'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useGlobalProjectsList } from '@/hooks/api/useProjects';
import { ProjectCard } from '@/components/organisms/Project/ProjectCard';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout/AdaptiveLayout';
import { routes } from '@/lib/constants/routes';
import { SortToggle } from '@/components/ui/SortToggle';
import { BottomActionSheet } from '@/components/ui/BottomActionSheet';
import { Plus, FolderKanban, Search, Filter, X } from 'lucide-react';

const createButtonClass =
  'inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 border border-input bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 hover:text-base-content text-base-content dark:text-base-content/70 h-9 rounded-xl px-3 gap-2';

type ProjectStatusFilter = 'active' | 'closed' | 'archived' | 'all';

export default function ProjectsPageClient() {
  const router = useRouter();
  const t = useTranslations('projects');
  const tCommon = useTranslations('common');
  const tCommunities = useTranslations('communities');
  const [searchQuery, setSearchQuery] = useState('');
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [sort, setSort] = useState<'createdAt' | 'score'>('createdAt');
  const [bOpenFilters, setBOpenFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ProjectStatusFilter>('all');

  const projectStatus =
    statusFilter === 'all' ? undefined : (statusFilter as 'active' | 'closed' | 'archived');

  const { data, isLoading } = useGlobalProjectsList({
    page: 1,
    pageSize: 50,
    search: searchQuery.trim() || undefined,
    sort,
    projectStatus,
  });

  const items = data?.data ?? [];

  const handleOpenSearch = () => {
    setLocalSearchQuery(searchQuery);
    setShowSearchModal(true);
  };

  const handleCloseSearch = () => {
    setSearchQuery(localSearchQuery);
    setShowSearchModal(false);
  };

  const handleSortChange = (value: 'recent' | 'voted') => {
    setSort(value === 'recent' ? 'createdAt' : 'score');
  };

  return (
    <AdaptiveLayout>
      <div className="flex flex-col gap-4 p-4">
        <div className="rounded-xl bg-gray-100 dark:bg-gray-800/50 p-5 shadow-[0_2px_8px_rgba(0,0,0,0.08)] space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className={createButtonClass}
                onClick={() => router.push('/meriter/projects/create')}
                aria-label={t('create')}
              >
                <Plus size={16} />
                {t('create')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleOpenSearch}
                className="rounded-xl active:scale-[0.98] px-2"
                aria-label={tCommon('search')}
                title={tCommon('search')}
              >
                <Search size={18} className="text-base-content/70" />
              </Button>
              <div className="flex gap-0.5 bg-base-200/50 p-0.5 rounded-lg">
                <SortToggle
                  value={sort === 'createdAt' ? 'recent' : 'voted'}
                  onChange={handleSortChange}
                  compact={true}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant={bOpenFilters ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setBOpenFilters((s) => !s)}
                className="gap-2"
                aria-label={tCommunities('filters.title')}
              >
                <Filter className="h-4 w-4 shrink-0" />
                <span className="hidden xl:inline">{tCommunities('filters.title')}</span>
              </Button>
            </div>
          </div>

          {bOpenFilters && (
            <div className="pt-1 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-base-content/60">{t('status')}:</span>
              {(['all', 'active', 'closed', 'archived'] as const).map((s) => (
                <Button
                  key={s}
                  variant={statusFilter === s ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setStatusFilter(s)}
                >
                  {s === 'all' ? t('filterAll') : t(s)}
                </Button>
              ))}
            </div>
          )}
        </div>

        {showSearchModal && (
          <BottomActionSheet isOpen={showSearchModal} onClose={handleCloseSearch} title={tCommon('search')}>
            <div className="relative w-full">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
              <Input
                type="text"
                placeholder={tCommon('searchPlaceholder')}
                value={localSearchQuery}
                onChange={(e) => setLocalSearchQuery(e.target.value)}
                className="h-11 rounded-xl pl-10 pr-10"
                autoFocus
              />
              {localSearchQuery && (
                <button
                  type="button"
                  onClick={() => setLocalSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-10"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </BottomActionSheet>
        )}

        {isLoading ? (
          <p className="text-sm text-base-content/60">{tCommon('loading')}</p>
        ) : items.length === 0 ? (
          <div className="rounded-xl bg-base-100 py-12 px-4 text-center">
            <FolderKanban className="mx-auto h-12 w-12 text-base-content/30" />
            <p className="mt-3 text-sm font-medium text-base-content/70">{t('noProjects')}</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-4 list-none p-0 m-0">
            {items.map(({ project, parentCommunityName }) => (
              <li key={project.id}>
                {parentCommunityName && project.parentCommunityId && (
                  <Link
                    href={routes.community(project.parentCommunityId)}
                    className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-base-content/50 hover:text-base-content/80 focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {parentCommunityName}
                  </Link>
                )}
                {parentCommunityName && !project.parentCommunityId && (
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-base-content/50">
                    {parentCommunityName}
                  </p>
                )}
                <ProjectCard project={project} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdaptiveLayout>
  );
}
