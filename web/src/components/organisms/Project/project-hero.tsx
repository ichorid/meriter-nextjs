'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Settings, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/shadcn/avatar';
import { routes } from '@/lib/constants/routes';
import { cn } from '@/lib/utils';
import type { Community } from '@meriter/shared-types';

function projectGradient(name: string): [string, string] {
  const colors: [string, string][] = [
    ['from-blue-600', 'to-purple-600'],
    ['from-emerald-500', 'to-teal-600'],
    ['from-orange-500', 'to-red-600'],
    ['from-pink-500', 'to-rose-600'],
    ['from-indigo-500', 'to-blue-600'],
    ['from-amber-500', 'to-orange-600'],
  ];
  const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
  return colors[index] ?? ['from-blue-600', 'to-purple-600'];
}

export type ProjectHeroProject = Pick<
  Community,
  'id' | 'name' | 'description' | 'avatarUrl' | 'coverImageUrl' | 'projectStatus'
> & { futureVisionCover?: string };

export interface ProjectHeroParentCommunity {
  id: string;
  name: string;
}

export interface ProjectHeroProps {
  project: ProjectHeroProject;
  parentCommunity: ProjectHeroParentCommunity | null;
  /** When true, show personal-project line instead of parent community link. */
  isPersonalProject?: boolean;
  statusLabel: string;
  status: 'active' | 'closed' | 'archived';
  /** Lead or superadmin: project settings shortcut on cover. */
  showModerationLinks?: boolean;
}

export function ProjectHero({
  project,
  parentCommunity,
  statusLabel,
  status,
  showModerationLinks = false,
}: ProjectHeroProps) {
  const router = useRouter();
  const t = useTranslations('projects');
  const tCommon = useTranslations('common');

  const [gradientFrom, gradientTo] = projectGradient(project.name);
  const coverImageUrl = project.coverImageUrl ?? project.futureVisionCover;
  const hasCover = !!coverImageUrl;

  const [descExpanded, setDescExpanded] = useState(false);
  const description = project.description?.trim();
  const hasLongDescription = description && description.length > 160;

  return (
    <header className="bg-base-100 rounded-xl overflow-hidden shadow-none border border-white/10">
      <div
        className={cn(
          'relative h-40 sm:h-[200px] w-full',
          !hasCover && `bg-gradient-to-r ${gradientFrom} ${gradientTo}`,
        )}
        style={
          hasCover
            ? {
                backgroundImage: `url(${coverImageUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      >
        <div className="absolute inset-0 bg-black/20" aria-hidden />

        {showModerationLinks && (
          <button
            type="button"
            onClick={() => router.push(routes.communitySettings(project.id))}
            className="absolute top-3 right-3 p-2 rounded-full bg-black/45 hover:bg-black/55 transition-colors backdrop-blur-sm"
            title={tCommon('settings')}
          >
            <Settings size={18} className="text-white" />
          </button>
        )}
      </div>

      <div className="relative px-4">
        <div className="-mt-12 sm:-mt-14 mb-3 relative z-10">
          <div className="relative inline-block ring-4 ring-base-100 rounded-2xl bg-base-100">
            <Avatar className="w-[72px] h-[72px] sm:w-20 sm:h-20 text-xl rounded-2xl bg-base-200">
              {project.avatarUrl && (
                <AvatarImage src={project.avatarUrl} alt="" className="rounded-2xl object-cover" />
              )}
              <AvatarFallback communityId={project.id} className="rounded-2xl font-medium uppercase">
                {project.name ? project.name.slice(0, 2).toUpperCase() : <User size={28} />}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>

        <div className="pb-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-base-content">{project.name}</h1>
            <span
              className={cn(
                'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium',
                status === 'active' && 'bg-green-600/20 text-green-400',
                status === 'closed' && 'bg-white/10 text-base-content/70',
                status === 'archived' && 'bg-white/10 text-base-content/50',
              )}
            >
              {statusLabel}
            </span>
          </div>

          {description && (
            <div className="text-sm text-base-content/70">
              <p className={cn(!descExpanded && hasLongDescription && 'line-clamp-2')}>{description}</p>
              {hasLongDescription && (
                <button
                  type="button"
                  onClick={() => setDescExpanded((e) => !e)}
                  className="mt-1 text-blue-400 hover:underline text-xs font-medium"
                >
                  {descExpanded ? t('showLess') : t('showMore')}
                </button>
              )}
            </div>
          )}

          {isPersonalProject ? (
            <p className="text-sm text-base-content/60">{t('personalProject')}</p>
          ) : (
            parentCommunity && (
              <p className="text-sm text-base-content/60">
                {t('parentCommunity')}:{' '}
                <Link
                  href={`/meriter/communities/${parentCommunity.id}`}
                  className="text-blue-400 hover:underline"
                >
                  {parentCommunity.name}
                </Link>
              </p>
            )
          )}
        </div>
      </div>
    </header>
  );
}
