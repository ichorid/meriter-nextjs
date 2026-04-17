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
import {
  EventDateTimeRangeFields,
  mergeDateTimeParts,
  splitToDateTimeParts,
} from './EventDateTimeRangeFields';

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
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('10:00');
  const [eventTime, setEventTime] = useState('');
  const [eventLocation, setEventLocation] = useState('');

  useEffect(() => {
    if (!open || !initial) return;
    setTitle(initial.title ?? '');
    setDescription(initial.description ?? '');
    setContent(initial.content);
    const s = splitToDateTimeParts(initial.eventStartDate);
    const e = splitToDateTimeParts(initial.eventEndDate);
    setStartDate(s.date);
    setStartTime(s.time);
    setEndDate(e.date);
    setEndTime(e.time);
    setEventTime(initial.eventTime ?? '');
    setEventLocation(initial.eventLocation ?? '');
  }, [open, initial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!initial?.publicationId) return;
    const start = mergeDateTimeParts(startDate, startTime);
    const end = mergeDateTimeParts(endDate, endTime);
    if (!start || !end) {
      addToast(t('createDateRequired'), 'error');
      return;
    }
    if (start.getTime() >= end.getTime()) {
      addToast(t('createEndBeforeStart'), 'error');
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
      <DialogContent className="max-h-[90vh] min-w-0 max-w-[calc(100vw-1.5rem)] overflow-y-auto overflow-x-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('editTitle')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="min-w-0 space-y-3">
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
          <EventDateTimeRangeFields
            idPrefix="ev-edit"
            startDate={startDate}
            startTime={startTime}
            endDate={endDate}
            endTime={endTime}
            onStartDateChange={setStartDate}
            onStartTimeChange={setStartTime}
            onEndDateChange={setEndDate}
            onEndTimeChange={setEndTime}
          />
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
