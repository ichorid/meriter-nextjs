'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import type { Community } from '@meriter/shared-types';
import { CooperativeSharesDisplay } from '@/components/molecules/CooperativeSharesDisplay';
import { Badge } from '@/components/ui/shadcn/badge';
import { useOpenTickets } from '@/hooks/api/useProjects';
import { useApplyForTicket } from '@/hooks/api/useTickets';
import { useUIStore } from '@/stores/ui.store';
import { shareUrl } from '@shared/lib/share-utils';
import { formatMerits } from '@/lib/utils/currency';
import { ArrowUp, Share2, TrendingUp, Users } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import { NeutralTicketPublicCard } from './NeutralTicketPublicCard';

export interface ProjectCardProps {
  project: Community;
  /** When project has an associated publication (e.g. on Birzha), pass its id for Support voting. */
  publicationId?: string | null;
  /** Score from API when available (e.g. from publication). */
  score?: number;
  /** Member/participant count when available. */
  memberCount?: number;
}

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

export function ProjectCard({
  project,
  publicationId = null,
  score = 0,
  memberCount = 0,
}: ProjectCardProps) {
  const t = useTranslations('projects');
  const tCommon = useTranslations('common');
  const tShared = useTranslations('shared');
  const router = useRouter();
  const { user } = useAuth();
  const openVotingPopup = useUIStore((s) => s.openVotingPopup);
  const { data: openTickets = [] } = useOpenTickets(project.id);
  const applyForTicket = useApplyForTicket();
  const status = project.projectStatus ?? 'active';
  const statusLabel =
    status === 'active' ? t('active') : status === 'closed' ? t('closed') : t('archived');
  const showOpenTickets = status === 'active' && openTickets.length > 0;
  const [gradientFrom, gradientTo] = projectGradient(project.name);
  const coverImageUrl = project.coverImageUrl ?? (project as { futureVisionCover?: string }).futureVisionCover;
  const hasCover = !!coverImageUrl;

  const projectUrl = `/meriter/projects/${project.id}`;

  const handleShareClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}${projectUrl}` : projectUrl;
    await shareUrl(fullUrl, tShared('urlCopiedToBuffer'));
  };

  const handleSupportClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (publicationId) {
      openVotingPopup(publicationId, 'publication', 'wallet-only');
    } else {
      router.push(projectUrl);
    }
  };

  return (
    <div className="rounded-xl overflow-hidden bg-[#F5F5F5] dark:bg-[#2a3239] p-5 shadow-none hover:shadow-[0_8px_16px_rgba(0,0,0,0.15)] hover:scale-[1.01] hover:-translate-y-0.5 transition-all duration-300 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
      <Link href={projectUrl} className="block outline-none">
        <div className="h-28 w-full relative overflow-hidden flex-shrink-0 rounded-lg mb-4">
          {hasCover ? (
            <img src={coverImageUrl} alt="" className="object-cover w-full h-full" />
          ) : (
            <div
              className={`w-full h-full bg-gradient-to-r ${gradientFrom} ${gradientTo}`}
              aria-hidden
            />
          )}
        </div>

        <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
          <h3 className="text-lg font-semibold text-base-content leading-tight line-clamp-2 flex-1 min-w-0">
            {project.name}
          </h3>
          <Badge variant={status === 'active' ? 'default' : 'secondary'} className="shrink-0">
            {statusLabel}
          </Badge>
        </div>
        {project.description && (
          <p className="text-sm text-base-content/70 mb-2 line-clamp-2">{project.description}</p>
        )}
        {((project.founderSharePercent ?? 0) > 0 || (project.investorSharePercent ?? 0) > 0) && (
          <div className="mb-3">
            <CooperativeSharesDisplay
              founderSharePercent={project.founderSharePercent ?? 0}
              investorSharePercent={project.investorSharePercent ?? 0}
            />
          </div>
        )}
      </Link>

      <div className="pt-3 border-t border-base-300">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 min-w-0">
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0 min-w-0">
            <span
              className="flex items-center gap-1.5 text-sm hover:bg-base-200 rounded-lg px-2 py-1.5 transition-colors group flex-shrink-0"
              title={tShared('totalVotesTooltip', { defaultValue: 'Total votes including withdrawn' })}
            >
              <TrendingUp className="w-4 h-4 text-base-content/50 group-hover:text-base-content/70 flex-shrink-0" />
              <span
                className={`font-medium tabular-nums ${
                  score > 0
                    ? 'text-success'
                    : score < 0
                      ? 'text-error'
                      : 'text-base-content/60'
                }`}
              >
                {score > 0 ? '+' : ''}
                {formatMerits(score)}
              </span>
            </span>
            <span
              className="flex items-center gap-1.5 text-sm text-base-content/60 flex-shrink-0"
              aria-label={t('members')}
            >
              <Users className="w-4 h-4 flex-shrink-0" aria-hidden />
              {memberCount}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={handleShareClick}
              className="p-1.5 rounded-full hover:bg-base-200 transition-colors text-base-content/60 hover:text-base-content/80 flex-shrink-0"
              title={tShared('share', { defaultValue: 'Share' })}
              aria-label={tShared('share', { defaultValue: 'Share' })}
            >
              <Share2 className="w-4 h-4" />
            </button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-lg px-2.5 text-xs shrink-0"
              onClick={handleSupportClick}
              aria-label={tCommon('support', { defaultValue: 'Support' })}
            >
              <ArrowUp className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="whitespace-nowrap">{tCommon('support', { defaultValue: 'Support' })}</span>
            </Button>
          </div>
        </div>
      </div>

      {showOpenTickets && (
        <div className="pt-3 border-t border-base-300 mt-3">
          <h4 className="text-sm font-medium mb-2">{t('openTasks', { defaultValue: 'Open tasks' })}</h4>
          <div
            className="space-y-2"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {openTickets.map((ticket: { id: string; title?: string; description?: string }) => (
              <NeutralTicketPublicCard
                key={ticket.id}
                ticket={ticket}
                projectId={project.id}
                onApply={(ticketId) => applyForTicket.mutate({ ticketId })}
                isApplying={applyForTicket.isPending}
                isAuthenticated={!!user}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
