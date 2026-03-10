'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/shadcn/button';
import { Card, CardContent, CardHeader } from '@/components/ui/shadcn/card';

export interface NeutralTicketPublicCardProps {
  ticket: { id: string; title?: string; description?: string };
  projectId: string;
  onApply: (ticketId: string) => void;
  isApplying?: boolean;
  isAuthenticated: boolean;
}

export function NeutralTicketPublicCard({
  ticket,
  projectId,
  onApply,
  isApplying = false,
  isAuthenticated,
}: NeutralTicketPublicCardProps) {
  const t = useTranslations('projects');

  return (
    <Card className="transition-shadow">
      <CardHeader className="pb-1">
        <h4 className="font-medium text-sm line-clamp-2">{ticket.title || t('untitledTask', { defaultValue: 'Task' })}</h4>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {ticket.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{ticket.description}</p>
        )}
        {isAuthenticated && (
          <Button
            size="sm"
            variant="secondary"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onApply(ticket.id);
            }}
            disabled={isApplying}
          >
            {isApplying ? '…' : t('iWillTake', { defaultValue: 'I\'ll take it' })}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
