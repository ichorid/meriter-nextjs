'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { EventCreateInputSchema } from '@meriter/shared-types';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';
import { Button } from '@/components/ui/shadcn/button';
import { Label } from '@/components/ui/shadcn/label';
import { Input } from '@/components/ui/shadcn/input';
import { Textarea } from '@/components/ui/shadcn/textarea';
import { Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { resolveApiErrorToastMessage } from '@/lib/i18n/api-error-toast';
import { useToastStore } from '@/shared/stores/toast.store';

export interface EventCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communityId: string;
  onCreated?: (publicationId: string) => void;
}

function toDateFromLocal(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function EventCreateDialog({
  open,
  onOpenChange,
  communityId,
  onCreated,
}: EventCreateDialogProps) {
  const t = useTranslations('events');
  const addToast = useToastStore((s) => s.addToast);
  const utils = trpc.useUtils();
  const createMutation = trpc.events.createEvent.useMutation();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [eventStartLocal, setEventStartLocal] = useState('');
  const [eventEndLocal, setEventEndLocal] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [eventLocation, setEventLocation] = useState('');

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setDescription('');
    setContent('');
    setEventStartLocal('');
    setEventEndLocal('');
    setEventTime('');
    setEventLocation('');
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const start = toDateFromLocal(eventStartLocal);
    const end = toDateFromLocal(eventEndLocal);
    if (!start || !end) {
      addToast(t('createDateRequired'), 'error');
      return;
    }
    const parsed = EventCreateInputSchema.safeParse({
      communityId,
      title: title.trim(),
      description: description.trim(),
      content: content.trim(),
      type: 'text' as const,
      eventStartDate: start,
      eventEndDate: end,
      eventTime: eventTime.trim() || undefined,
      eventLocation: eventLocation.trim() || undefined,
    });
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? t('createValidationFailed');
      addToast(msg, 'error');
      return;
    }

    try {
      const res = await createMutation.mutateAsync(parsed.data);
      addToast(t('createSuccess'), 'success');
      onOpenChange(false);
      await utils.events.getEventsByCommunity.invalidate({ communityId });
      onCreated?.(res.id);
    } catch (err: unknown) {
      addToast(resolveApiErrorToastMessage(err instanceof Error ? err.message : undefined), 'error');
    }
  };

  const busy = createMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('createTitle')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="ev-title">{t('fieldTitle')}</Label>
            <Input
              id="ev-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={500}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ev-desc">{t('fieldDescription')}</Label>
            <Textarea
              id="ev-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={3}
              maxLength={5000}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ev-content">{t('fieldDetails')}</Label>
            <Textarea
              id="ev-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              rows={4}
              maxLength={10000}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="ev-start">{t('fieldStart')}</Label>
              <Input
                id="ev-start"
                type="datetime-local"
                value={eventStartLocal}
                onChange={(e) => setEventStartLocal(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ev-end">{t('fieldEnd')}</Label>
              <Input
                id="ev-end"
                type="datetime-local"
                value={eventEndLocal}
                onChange={(e) => setEventEndLocal(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ev-time">{t('fieldTimeOptional')}</Label>
            <Input id="ev-time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} maxLength={500} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ev-loc">{t('fieldLocationOptional')}</Label>
            <Input
              id="ev-loc"
              value={eventLocation}
              onChange={(e) => setEventLocation(e.target.value)}
              maxLength={2000}
            />
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : t('createSubmit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
