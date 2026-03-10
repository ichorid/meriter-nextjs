'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { TicketList } from './TicketList';
import { DiscussionList } from './DiscussionList';
import { CreateTicketForm } from './CreateTicketForm';
import { ProjectSharesDisplay } from './ProjectSharesDisplay';
import { Button } from '@/components/ui/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/shadcn/dialog';

type TabId = 'tickets' | 'discussions';

interface ProjectTabsProps {
  projectId: string;
  currentUserId: string;
  isLead: boolean;
  isMember: boolean;
}

export function ProjectTabs({
  projectId,
  currentUserId,
  isLead,
  isMember,
}: ProjectTabsProps) {
  const t = useTranslations('projects');
  const [activeTab, setActiveTab] = useState<TabId>('tickets');
  const [createTicketOpen, setCreateTicketOpen] = useState(false);

  if (!isMember) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 border-b">
        <button
          type="button"
          onClick={() => setActiveTab('tickets')}
          className={cn(
            'border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            activeTab === 'tickets'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {t('tabs.tickets')}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('discussions')}
          className={cn(
            'border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            activeTab === 'discussions'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {t('tabs.discussions')}
        </button>
        {activeTab === 'discussions' && (
          <Button size="sm" variant="outline" className="ml-auto" asChild>
            <Link href={`/meriter/communities/${projectId}/create?postType=discussion`}>
              {t('createDiscussion')}
            </Link>
          </Button>
        )}
        {isLead && activeTab === 'tickets' && (
          <Dialog open={createTicketOpen} onOpenChange={setCreateTicketOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="ml-auto">{t('createTicket')}</Button>
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

      {activeTab === 'tickets' && (
        <TicketList
          projectId={projectId}
          currentUserId={currentUserId}
          isLead={isLead}
        />
      )}
      {activeTab === 'discussions' && <DiscussionList projectId={projectId} />}

      <ProjectSharesDisplay projectId={projectId} />
    </div>
  );
}
