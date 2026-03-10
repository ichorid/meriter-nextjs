'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import type { Community } from '@meriter/shared-types';
import { CooperativeSharesDisplay } from '@/components/molecules/CooperativeSharesDisplay';
import { Card, CardContent, CardHeader } from '@/components/ui/shadcn/card';
import { Badge } from '@/components/ui/shadcn/badge';
import { useOpenTickets } from '@/hooks/api/useProjects';
import { useApplyForTicket } from '@/hooks/api/useTickets';
import { NeutralTicketPublicCard } from './NeutralTicketPublicCard';

export interface ProjectCardProps {
  project: Community;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const t = useTranslations('projects');
  const { user } = useAuth();
  const { data: openTickets = [] } = useOpenTickets(project.id);
  const applyForTicket = useApplyForTicket();
  const status = project.projectStatus ?? 'active';
  const statusLabel = status === 'active' ? t('active') : status === 'closed' ? t('closed') : t('archived');
  const showOpenTickets = status === 'active' && openTickets.length > 0;

  return (
    <Card className="h-full transition-shadow hover:shadow-md">
      <Link href={`/meriter/projects/${project.id}`} className="block">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold line-clamp-2">{project.name}</h3>
            <Badge variant={status === 'active' ? 'default' : 'secondary'}>{statusLabel}</Badge>
          </div>
          {project.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{project.description}</p>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          <CooperativeSharesDisplay
            founderSharePercent={project.founderSharePercent ?? 0}
            investorSharePercent={project.investorSharePercent ?? 0}
          />
        </CardContent>
      </Link>
      {showOpenTickets && (
        <CardContent className="pt-0 border-t">
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
        </CardContent>
      )}
    </Card>
  );
}
