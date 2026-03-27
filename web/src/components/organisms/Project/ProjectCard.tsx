'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/api/useProfile';
import type { Community } from '@meriter/shared-types';
import { CooperativeSharesDisplay } from '@/components/molecules/CooperativeSharesDisplay';
import { Badge } from '@/components/ui/shadcn/badge';
import { useOpenTickets } from '@/hooks/api/useProjects';
import { useApplyForTicket } from '@/hooks/api/useTickets';
import { TopUpWalletDialog } from './TopUpWalletDialog';
import { shareUrl } from '@shared/lib/share-utils';
import { cn } from '@/lib/utils';
import { ArrowUp, ChevronDown, PiggyBank, Share2, Users } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import { NeutralTicketPublicCard } from './NeutralTicketPublicCard';

export interface ProjectCardProps {
  project: Community;
  /** Active members from API (e.g. project.getGlobalList `memberCount`). */
  memberCount?: number;
  /** When set, value tag chips call this (e.g. Birzha / projects list filter). */
  onValueTagClick?: (tag: string) => void;
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
  memberCount,
  onValueTagClick,
}: ProjectCardProps) {
  const t = useTranslations('projects');
  const tInvesting = useTranslations('investing');
  const tShared = useTranslations('shared');
  const { user } = useAuth();
  const { data: userRoles = [] } = useUserRoles(user?.id || '');
  const isProjectMember = useMemo(() => {
    if (!user) return false;
    const inRoles = userRoles.some(
      (r) =>
        r.communityId === project.id && (r.role === 'lead' || r.role === 'participant'),
    );
    const inMembersList = Array.isArray(project.members) && project.members.includes(user.id);
    return inRoles || inMembersList;
  }, [user, userRoles, project.id, project.members]);

  /** Defer N× getOpenTickets until after first paint / idle so list + invest modal do not saturate one tRPC batch / DB pool */
  const [openTicketsFetchEnabled, setOpenTicketsFetchEnabled] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window;
    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(() => setOpenTicketsFetchEnabled(true), { timeout: 800 });
      return () => w.cancelIdleCallback(id);
    }
    const t = w.setTimeout(() => setOpenTicketsFetchEnabled(true), 400);
    return () => w.clearTimeout(t);
  }, []);
  const status = project.projectStatus ?? 'active';
  const { data: openTickets = [] } = useOpenTickets(project.id, {
    enabled: openTicketsFetchEnabled && status === 'active',
  });
  const applyForTicket = useApplyForTicket();
  const [openTasksExpanded, setOpenTasksExpanded] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [investorFlow, setInvestorFlow] = useState(false);
  const statusLabel =
    status === 'active' ? t('active') : status === 'closed' ? t('closed') : t('archived');
  const showOpenTickets = status === 'active' && openTickets.length > 0;
  const [gradientFrom, gradientTo] = projectGradient(project.name);
  const coverImageUrl = project.coverImageUrl ?? (project as { futureVisionCover?: string }).futureVisionCover;
  const hasCover = !!coverImageUrl;

  const projectUrl = `/meriter/projects/${project.id}`;
  const investingEnabled = project.settings?.investingEnabled === true;
  const memberWithInvesting = investingEnabled && isProjectMember;

  const handleShareClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}${projectUrl}` : projectUrl;
    await shareUrl(fullUrl, tShared('urlCopiedToBuffer'));
  };

  const openMemberTopUp = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setInvestorFlow(false);
    setTopUpOpen(true);
  };

  const openInvestorFlowClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setInvestorFlow(true);
    setTopUpOpen(true);
  };

  const handleTopUpDialogOpenChange = (open: boolean) => {
    setTopUpOpen(open);
    if (!open) {
      setInvestorFlow(false);
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
        {project.futureVisionTags &&
          Array.isArray(project.futureVisionTags) &&
          project.futureVisionTags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {project.futureVisionTags.map((tag) =>
                onValueTagClick ? (
                  <button
                    key={tag}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onValueTagClick(tag);
                    }}
                    className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-normal text-base-content/80 bg-base-200 hover:bg-base-300 cursor-pointer transition-colors text-left"
                  >
                    {tag}
                  </button>
                ) : (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-normal text-base-content/80 bg-base-200"
                  >
                    {tag}
                  </span>
                ),
              )}
            </div>
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
        <div
          className={cn(
            'flex flex-wrap items-center gap-x-4 gap-y-2 min-w-0',
            typeof memberCount === 'number' ? 'justify-between' : 'justify-end',
          )}
        >
          {typeof memberCount === 'number' ? (
            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0 min-w-0">
              <span
                className="flex items-center gap-1.5 text-sm text-base-content/60 flex-shrink-0"
                aria-label={t('members')}
              >
                <Users className="w-4 h-4 flex-shrink-0" aria-hidden />
                <span className="tabular-nums">{memberCount}</span>
              </span>
            </div>
          ) : null}
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
            {memberWithInvesting ? (
              <div className="flex flex-row flex-wrap gap-1.5 items-center justify-end shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 rounded-lg px-2.5 text-xs shrink-0"
                  onClick={openMemberTopUp}
                  aria-label={t('projectWalletTopUpSubmit')}
                >
                  <ArrowUp className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
                  <span className="whitespace-nowrap">{t('projectWalletTopUpSubmit')}</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 rounded-lg px-2.5 text-xs shrink-0"
                  onClick={openInvestorFlowClick}
                  aria-label={t('projectInvestSubmit')}
                >
                  <PiggyBank className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
                  <span className="whitespace-nowrap">{t('projectInvestSubmit')}</span>
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 rounded-lg px-2.5 text-xs shrink-0"
                onClick={investingEnabled ? openInvestorFlowClick : openMemberTopUp}
                aria-label={
                  investingEnabled
                    ? tInvesting('invest', { defaultValue: 'Invest' })
                    : t('projectCardSupportVerb', { defaultValue: 'Support' })
                }
              >
                {investingEnabled ? (
                  <PiggyBank className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
                ) : (
                  <ArrowUp className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
                )}
                <span className="whitespace-nowrap">
                  {investingEnabled
                    ? tInvesting('invest', { defaultValue: 'Invest' })
                    : t('projectCardSupportVerb', { defaultValue: 'Support' })}
                </span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {showOpenTickets && (
        <div className="pt-3 border-t border-base-300 mt-3">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 rounded-lg py-1.5 -mx-1 px-1 text-left hover:bg-base-200/80 transition-colors"
            onClick={() => setOpenTasksExpanded((v) => !v)}
            aria-expanded={openTasksExpanded}
            aria-controls={`project-open-tasks-${project.id}`}
            id={`project-open-tasks-trigger-${project.id}`}
          >
            <span className="text-sm font-medium text-base-content">
              {t('openTasks', { defaultValue: 'Open tasks' })} ({openTickets.length})
            </span>
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 text-base-content/60 transition-transform',
                openTasksExpanded && 'rotate-180',
              )}
              aria-hidden
            />
          </button>
          {openTasksExpanded ? (
            <div
              id={`project-open-tasks-${project.id}`}
              role="region"
              aria-labelledby={`project-open-tasks-trigger-${project.id}`}
              className="space-y-2 mt-2"
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
          ) : null}
        </div>
      )}
      <TopUpWalletDialog
        projectId={project.id}
        placeholderProject={project}
        open={topUpOpen}
        onOpenChange={handleTopUpDialogOpenChange}
        investorFlow={investorFlow}
      />
    </div>
  );
}
