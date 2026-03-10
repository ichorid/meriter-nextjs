'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useCreateNeutralTicket } from '@/hooks/api/useTickets';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Label } from '@/components/ui/shadcn/label';
import { Textarea } from '@/components/ui/shadcn/textarea';
import { cn } from '@/lib/utils';

interface CreateNeutralTicketFormProps {
  projectId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
}

export function CreateNeutralTicketForm({
  projectId,
  onSuccess,
  onCancel,
  className,
}: CreateNeutralTicketFormProps) {
  const t = useTranslations('projects');
  const createNeutral = useCreateNeutralTicket();
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    try {
      await createNeutral.mutateAsync({
        projectId,
        content: content.trim(),
        title: title.trim() || undefined,
        description: description.trim() || undefined,
      });
      setContent('');
      setTitle('');
      setDescription('');
      onSuccess?.();
    } catch {
      // Toast in hook
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-4', className)}>
      <div>
        <Label htmlFor="neutral-ticket-title">{t('title', { defaultValue: 'Title' })} (optional)</Label>
        <Input
          id="neutral-ticket-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('shortTitle', { defaultValue: 'Short title' })}
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="neutral-ticket-description">{t('description', { defaultValue: 'Description' })} (optional)</Label>
        <Textarea
          id="neutral-ticket-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('details', { defaultValue: 'Details' })}
          rows={2}
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="neutral-ticket-content">{t('content', { defaultValue: 'Content' })} *</Label>
        <Textarea
          id="neutral-ticket-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t('taskDescription', { defaultValue: 'Task description' })}
          rows={3}
          required
          className="mt-1"
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={createNeutral.isPending || !content.trim()}>
          {createNeutral.isPending ? '…' : t('createOpenTask', { defaultValue: 'Create open task' })}
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
