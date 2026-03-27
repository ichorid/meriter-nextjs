'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useCreateTicket, useCreateNeutralTicket } from '@/hooks/api/useTickets';
import { useProjectMembers } from '@/hooks/api/useProjects';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Label } from '@/components/ui/shadcn/label';
import { Textarea } from '@/components/ui/shadcn/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/shadcn/select';
import { cn } from '@/lib/utils';

/** Select value: assignee not fixed — anyone can claim (neutral ticket). */
const OPEN_ASSIGNMENT_VALUE = '__open__';

interface CreateTicketFormProps {
  projectId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
}

export function CreateTicketForm({
  projectId,
  onSuccess,
  onCancel,
  className,
}: CreateTicketFormProps) {
  const t = useTranslations('projects');
  const createTicket = useCreateTicket();
  const createNeutral = useCreateNeutralTicket();
  const { data: membersData } = useProjectMembers(projectId, { limit: 100 });
  const members = membersData?.data ?? [];

  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [beneficiaryId, setBeneficiaryId] = useState<string>(OPEN_ASSIGNMENT_VALUE);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !title.trim()) return;
    try {
      if (beneficiaryId === OPEN_ASSIGNMENT_VALUE) {
        await createNeutral.mutateAsync({
          projectId,
          content: content.trim(),
          title: title.trim(),
        });
      } else {
        await createTicket.mutateAsync({
          projectId,
          content: content.trim(),
          title: title.trim(),
          beneficiaryId,
        });
      }
      setContent('');
      setTitle('');
      setBeneficiaryId(OPEN_ASSIGNMENT_VALUE);
      onSuccess?.();
    } catch {
      // Toast handled in hook
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-4', className)}>
      <div>
        <Label htmlFor="ticket-beneficiary">{t('beneficiary')}</Label>
        <Select value={beneficiaryId} onValueChange={setBeneficiaryId}>
          <SelectTrigger id="ticket-beneficiary" className="mt-1">
            <SelectValue placeholder={t('ticketSelectAssigneePlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={OPEN_ASSIGNMENT_VALUE}>
              {t('ticketAssigneeOpenAnyone')}
            </SelectItem>
            {members.map((m: { id?: string; userId?: string; displayName?: string }) => {
              const id = m.id ?? m.userId ?? '';
              const label = m.displayName ?? id.slice(0, 8);
              return (
                <SelectItem key={id} value={id}>
                  {label}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="ticket-title">
          {t('ticketTitleLabel')} <span className="text-destructive">*</span>
        </Label>
        <Input
          id="ticket-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('ticketTitlePlaceholder')}
          className="mt-1"
          required
        />
      </div>
      <div>
        <Label htmlFor="ticket-content">
          {t('taskFieldBody')} <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="ticket-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t('taskDescription')}
          rows={4}
          required
          className="mt-1"
        />
      </div>
      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={
            createTicket.isPending ||
            createNeutral.isPending ||
            !content.trim() ||
            !title.trim()
          }
        >
          {createTicket.isPending || createNeutral.isPending ? t('creating') : t('createTicket')}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            {t('cancel')}
          </Button>
        )}
      </div>
    </form>
  );
}
