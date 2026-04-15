'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { EventUpdateInputSchema } from '@meriter/shared-types';
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

export interface EventEditDialogInitial {
  publicationId: string;
  title?: string;
  description?: string;
  content: string;
  eventStartDate: Date | string;
  eventEndDate: Date | string;
  eventTime?: string;
  eventLocation?: string;
}

function toDatetimeLocalValue(d: Date | string): string {
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
}

function toDateFromLocal(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export interface EventEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communityId: string;
  initial: EventEditDialogInitial | null;
  onSaved?: () => void;
}

export function EventEditDialog({
  open,
  onOpenChange,
  communityId,
  initial,
  onSaved,
}: EventEditDialogProps) {
  const t = useTranslations('events');
  const addToast = useToastStore((s) => s.addToast);
  const utils = trpc.useUtils();
  const updateMutation = trpc.events.updateEvent.useMutation();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [eventStartLocal, setEventStartLocal] = useState('');
  const [eventEndLocal, setEventEndLocal] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [eventLocation, setEventLocation] = useState('');

  useEffect(() => {
    if (!open || !initial) return;
    setTitle(initial.title ?? '');
    setDescription(initial.description ?? '');
    setContent(initial.content);
    setEventStartLocal(toDatetimeLocalValue(initial.eventStartDate));
    setEventEndLocal(toDatetimeLocalValue(initial.eventEndDate));
    setEventTime(initial.eventTime ?? '');
    setEventLocation(initial.eventLocation ?? '');
  }, [open, initial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!initial?.publicationId) return;
    const start = toDateFromLocal(eventStartLocal);
    const end = toDateFromLocal(eventEndLocal);
    if (!start || !end) {
      addToast(t('createDateRequired'), 'error');
      return;
    }
    const parsed = EventUpdateInputSchema.safeParse({
      publicationId: initial.publicationId,
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
      await updateMutation.mutateAsync(parsed.data);
      addToast(t('editSuccess'), 'success');
      onOpenChange(false);
      await utils.events.getEventsByCommunity.invalidate({ communityId });
      await utils.publications.getById.invalidate({ id: initial.publicationId });
      onSaved?.();
    } catch (err: unknown) {
      addToast(resolveApiErrorToastMessage(err instanceof Error ? err.message : undefined), 'error');
    }
  };

  const busy = updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('editTitle')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="ev-edit-title">{t('fieldTitle')}</Label>
            <Input
              id="ev-edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={500}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ev-edit-desc">{t('fieldDescription')}</Label>
            <Textarea
              id="ev-edit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={3}
              maxLength={5000}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ev-edit-content">{t('fieldDetails')}</Label>
            <Textarea
              id="ev-edit-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              rows={4}
              maxLength={10000}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="ev-edit-start">{t('fieldStart')}</Label>
              <Input
                id="ev-edit-start"
                type="datetime-local"
                value={eventStartLocal}
                onChange={(e) => setEventStartLocal(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ev-edit-end">{t('fieldEnd')}</Label>
              <Input
                id="ev-edit-end"
                type="datetime-local"
                value={eventEndLocal}
                onChange={(e) => setEventEndLocal(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ev-edit-time">{t('fieldTimeOptional')}</Label>
            <Input id="ev-edit-time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} maxLength={500} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ev-edit-loc">{t('fieldLocationOptional')}</Label>
            <Input
              id="ev-edit-loc"
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
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : t('editSubmit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
