'use client';

import { useMemo, useState } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useGlobalProjectsList } from '@/hooks/api/useProjects';
import { ProjectCard } from '@/components/organisms/Project/ProjectCard';
import { Button } from '@/components/ui/shadcn/button';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout/AdaptiveLayout';
import { routes } from '@/lib/constants/routes';
import { SortToggle } from '@/components/ui/SortToggle';
import { InlineSearchField } from '@/components/ui/InlineSearchField';
import { Plus, FolderKanban, Filter } from 'lucide-react';
import { ValuesRubricatorPanel } from '@/shared/components/value-rubricator/ValuesRubricatorPanel';
import { usePlatformValueRubricatorSections } from '@/shared/hooks/usePlatformValueRubricator';

const createButtonClass =
  'inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 border border-input bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 hover:text-base-content text-base-content dark:text-base-content/70 h-9 rounded-xl px-3 gap-2';

type ProjectStatusFilter = 'active' | 'closed' | 'archived' | 'all';

export default function ProjectsPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations('projects');
  const tCommon = useTranslations('common');
  const tValues = useTranslations('valuesRubricator');
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState<'createdAt' | 'score'>('createdAt');
  const [bOpenFilters, setBOpenFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ProjectStatusFilter>('all');

  const { sections } = usePlatformValueRubricatorSections();

  const searchParamsKey = searchParams.toString();
  const selectedValueTags = useMemo(() => {
    const raw = new URLSearchParams(searchParamsKey).get('vt');
    return raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : [];
  }, [searchParamsKey]);

  const debouncedSearch = useDebounce(searchQuery, 350);

  const projectStatus =
    statusFilter === 'all' ? undefined : (statusFilter as 'active' | 'closed' | 'archived');

  const listInput = useMemo(
    () => ({
      page: 1 as const,
      pageSize: 50 as const,
      search: debouncedSearch.trim() || undefined,
      sort,
      projectStatus,
      valueTags: selectedValueTags.length > 0 ? selectedValueTags : undefined,
    }),
    [debouncedSearch, sort, projectStatus, selectedValueTags],
  );

  const { data, isPending, isError, error, refetch } = useGlobalProjectsList(listInput);

  const setValueTagsInUrl = (next: string[]) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next.length > 0) {
      params.set('vt', next.join(','));
    } else {
      params.delete('vt');
    }
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  const toggleValueTag = (tag: string) => {
    const next = selectedValueTags.includes(tag)
      ? selectedValueTags.filter((x) => x !== tag)
      : [...selectedValueTags, tag];
    setValueTagsInUrl(next);
  };

  const items = data?.data ?? [];

  const handleSortChange = (value: 'recent' | 'voted') => {
    setSort(value === 'recent' ? 'createdAt' : 'score');
  };

  return (
    <AdaptiveLayout>
      <div className="flex flex-col gap-4 p-4">
        <div className="rounded-xl bg-gray-100 dark:bg-gray-800/50 p-5 shadow-[0_2px_8px_rgba(0,0,0,0.08)] space-y-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-3">
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
                  aria-label={tValues('openButton')}
                >
                  <Filter className="h-4 w-4 shrink-0" />
                  <span className="hidden xl:inline">{tValues('openButton')}</span>
                </Button>
              </div>
            </div>
            <div className="min-w-0 w-full lg:max-w-2xl">
              <InlineSearchField
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder={tCommon('searchPlaceholder')}
                aria-label={tCommon('search')}
                clearAriaLabel={tCommon('clearSearch')}
              />
            </div>
          </div>

          {bOpenFilters && (
            <div className="pt-1 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
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
              <ValuesRubricatorPanel
                decree809Tags={sections.decree809}
                adminExtrasTags={sections.adminExtras}
                selectedTags={selectedValueTags}
                onToggleTag={toggleValueTag}
              />
            </div>
          )}

          {!bOpenFilters && selectedValueTags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1 text-xs text-base-content/70">
              {selectedValueTags.slice(0, 6).join(' · ')}
              {selectedValueTags.length > 6 ? ` +${selectedValueTags.length - 6}` : ''}
            </div>
          )}
        </div>

        {isPending && data === undefined ? (
          <p className="text-sm text-base-content/60">{tCommon('loading')}</p>
        ) : isError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-base-content">
            <p className="font-medium">{tCommon('somethingWentWrong')}</p>
            <p className="mt-1 text-base-content/70">
              {error?.message ?? tCommon('somethingWentWrongMessage')}
            </p>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
              {tCommon('retry')}
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl bg-base-100 py-12 px-4 text-center">
            <FolderKanban className="mx-auto h-12 w-12 text-base-content/30" />
            <p className="mt-3 text-sm font-medium text-base-content/70">{t('noProjects')}</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-4 list-none p-0 m-0">
            {items.map(({ project, parentCommunityName, founderDisplayName }) => (
              <li key={project.id}>
                {project.isPersonalProject === true && project.founderUserId ? (
                  <Link
                    href={routes.userProfile(project.founderUserId)}
                    className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-base-content/50 hover:text-base-content/80 focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {founderDisplayName ?? t('personalProject')}
                  </Link>
                ) : parentCommunityName && project.parentCommunityId ? (
                  <Link
                    href={routes.community(project.parentCommunityId)}
                    className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-base-content/50 hover:text-base-content/80 focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {parentCommunityName}
                  </Link>
                ) : null}
                <ProjectCard project={project} onValueTagClick={toggleValueTag} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdaptiveLayout>
  );
}
