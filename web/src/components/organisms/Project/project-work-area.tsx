'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { routes } from '@/lib/constants/routes';
import { TicketList } from './TicketList';
import { DiscussionList } from './DiscussionList';
import { CreateTicketForm } from './CreateTicketForm';
import { Button } from '@/components/ui/shadcn/button';
import { PublicationCreateForm } from '@/features/publications/components/PublicationCreateForm';
import { trpc } from '@/lib/trpc/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/shadcn/dialog';
import type { TicketStatus } from '@meriter/shared-types';

type TabId = 'tickets' | 'discussions';

export interface ProjectWorkAreaProps {
  projectId: string;
  currentUserId: string;
  /** Lead or superadmin: task moderation (create, accept, reopen, applicants). */
  canModerateTickets: boolean;
  isMember: boolean;
  readOnly?: boolean;
  /** Pilot: discussion list UX (FR-18…21). */
  discussionUxVariant?: 'default' | 'pilotAccordion';
  /** Pilot: «Задачи» / «Обсуждения» instead of default project tab copy (AC-6 partial). */
  usePilotTerms?: boolean;
  /** Pilot shell: no links to full Meriter community/post pages; discussions created in-dialog. */
  blockMeriterNavigation?: boolean;
}

export function ProjectWorkArea({
  projectId,
  currentUserId,
  canModerateTickets,
  isMember,
  readOnly = false,
  discussionUxVariant = 'default',
  usePilotTerms = false,
  blockMeriterNavigation = false,
}: ProjectWorkAreaProps) {
  const t = useTranslations('projects');
  const tPilot = useTranslations('multiObraz');
  const utils = trpc.useUtils();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>('tickets');
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const [createTicketOpen, setCreateTicketOpen] = useState(false);
  const [createDiscussionOpen, setCreateDiscussionOpen] = useState(false);

  const tabFromUrl = searchParams.get('tab');
  const highlightTicketId = searchParams.get('highlight');
  useEffect(() => {
    if (tabFromUrl === 'discussions') {
      setActiveTab('discussions');
    }
  }, [tabFromUrl]);

  useEffect(() => {
    if (highlightTicketId) {
      setActiveTab('tickets');
      setStatusFilter('all');
    }
  }, [highlightTicketId]);

  if (!isMember) {
    return null;
  }

  return (
    <section aria-labelledby="project-work-area-heading" className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-5 space-y-4">
      <h2 id="project-work-area-heading" className="sr-only">
        {usePilotTerms ? `${tPilot('tabTasks')} / ${tPilot('tabDiscussions')}` : `${t('tabs.tickets')} / ${t('tabs.discussions')}`}
      </h2>

      <div className="flex flex-wrap gap-4 border-b border-white/10">
        <button
          type="button"
          onClick={() => setActiveTab('tickets')}
          className={cn(
            'border-b-2 px-1 pb-2 text-sm font-medium transition-colors -mb-px',
            activeTab === 'tickets'
              ? 'border-blue-500 text-base-content'
              : 'border-transparent text-base-content/50 hover:text-base-content/80',
          )}
        >
          {usePilotTerms ? tPilot('tabTasks') : t('tabs.tickets')}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('discussions')}
          className={cn(
            'border-b-2 px-1 pb-2 text-sm font-medium transition-colors -mb-px',
            activeTab === 'discussions'
              ? 'border-blue-500 text-base-content'
              : 'border-transparent text-base-content/50 hover:text-base-content/80',
          )}
        >
          {usePilotTerms ? tPilot('tabDiscussions') : t('tabs.discussions')}
        </button>
      </div>

      {activeTab === 'tickets' && (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-base-content">{t('ticket')}</span>
            <select
              className="rounded-lg border border-white/10 bg-background px-2 py-1.5 text-sm text-base-content"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as TicketStatus | 'all')}
            >
              <option value="all">{t('filterAll')}</option>
              <option value="open">{t('statusOpen')}</option>
              <option value="in_progress">{t('statusInProgress')}</option>
              <option value="done">{t('statusDone')}</option>
              <option value="closed">{t('statusClosed')}</option>
            </select>
          </div>
          {canModerateTickets && !readOnly && (
            <Dialog open={createTicketOpen} onOpenChange={setCreateTicketOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="w-full sm:w-auto">
                  {t('createTicket')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('createTicket')}</DialogTitle>
                </DialogHeader>
                <CreateTicketForm
                  projectId={projectId}
                  onSuccess={() => setCreateTicketOpen(false)}
                  onCancel={() => setCreateTicketOpen(false)}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>
      )}

      {activeTab === 'discussions' && !readOnly && (
        <div className="flex justify-end">
          {blockMeriterNavigation ? (
            <Button size="sm" variant="outline" type="button" onClick={() => setCreateDiscussionOpen(true)}>
              {t('createDiscussion')}
            </Button>
          ) : (
            <Button size="sm" variant="outline" asChild>
              <Link href={routes.projectDiscussionCreate(projectId)}>{t('createDiscussion')}</Link>
            </Button>
          )}
        </div>
      )}

      {activeTab === 'tickets' && (
        <TicketList
          projectId={projectId}
          currentUserId={currentUserId}
          canModerateTickets={canModerateTickets}
          statusFilter={statusFilter}
          highlightTicketId={highlightTicketId}
          blockMeriterNavigation={blockMeriterNavigation}
          onOpenCreateTask={
            canModerateTickets && !readOnly ? () => setCreateTicketOpen(true) : undefined
          }
        />
      )}
      {activeTab === 'discussions' && (
        <DiscussionList
          projectId={projectId}
          uxVariant={discussionUxVariant}
          blockMeriterNavigation={blockMeriterNavigation}
          onPilotCreateDiscussion={
            blockMeriterNavigation && !readOnly ? () => setCreateDiscussionOpen(true) : undefined
          }
        />
      )}

      {blockMeriterNavigation && !readOnly && (
        <Dialog open={createDiscussionOpen} onOpenChange={setCreateDiscussionOpen}>
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto border-[#334155] bg-[#1e293b] text-[#f1f5f9]">
            <DialogHeader>
              <DialogTitle>{t('createDiscussion')}</DialogTitle>
            </DialogHeader>
            <PublicationCreateForm
              communityId={projectId}
              defaultPostType="discussion"
              isProjectCommunity
              showContextSwitcher={false}
              onCancel={() => setCreateDiscussionOpen(false)}
              onSuccess={() => {
                setCreateDiscussionOpen(false);
                void utils.ticket.getByProject.invalidate({ projectId });
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
