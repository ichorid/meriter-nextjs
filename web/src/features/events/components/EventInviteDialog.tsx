'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
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
import { Checkbox } from '@/components/ui/shadcn/checkbox';
import { Loader2, Copy } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { routes } from '@/lib/constants/routes';
import { useToastStore } from '@/shared/stores/toast.store';
import { resolveApiErrorToastMessage } from '@/lib/i18n/api-error-toast';

export interface EventInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  publicationId: string;
}

export function EventInviteDialog({ open, onOpenChange, publicationId }: EventInviteDialogProps) {
  const t = useTranslations('events');
  const addToast = useToastStore((s) => s.addToast);
  const [oneTime, setOneTime] = useState(false);
  const [maxUses, setMaxUses] = useState<string>('');
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const createLink = trpc.events.createInviteLink.useMutation();

  const handleGenerate = async () => {
    const maxParsed =
      maxUses.trim() === '' ? undefined : Number.parseInt(maxUses, 10);
    if (!oneTime && maxUses.trim() !== '' && (maxParsed == null || Number.isNaN(maxParsed) || maxParsed < 1)) {
      addToast(t('inviteMaxUsesInvalid'), 'error');
      return;
    }
    try {
      const options = oneTime
        ? { oneTime: true as const }
        : maxUses.trim() === ''
          ? undefined
          : { maxUses: maxParsed! };
      const rec = await createLink.mutateAsync({
        publicationId,
        options,
      });
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const url = `${origin}${routes.eventInvite(rec.token)}`;
      setInviteUrl(url);
      addToast(t('inviteGenerated'), 'success');
    } catch (e: unknown) {
      addToast(resolveApiErrorToastMessage(e instanceof Error ? e.message : undefined), 'error');
    }
  };

  const copy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      addToast(t('inviteCopied'), 'success');
    } catch {
      addToast(t('inviteCopyFailed'), 'error');
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          setInviteUrl(null);
          setOneTime(false);
          setMaxUses('');
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('inviteTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="flex items-center gap-2">
            <Checkbox
              id="ev-inv-one"
              checked={oneTime}
              onCheckedChange={(c) => setOneTime(c === true)}
            />
            <Label htmlFor="ev-inv-one" className="cursor-pointer font-normal">
              {t('inviteOneTime')}
            </Label>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ev-inv-max">{t('inviteMaxUses')}</Label>
            <Input
              id="ev-inv-max"
              type="number"
              min={1}
              placeholder={t('inviteMaxUsesPlaceholder')}
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              disabled={oneTime}
            />
          </div>
          {inviteUrl ? (
            <div className="space-y-1">
              <Label>{t('inviteUrlLabel')}</Label>
              <div className="flex gap-2">
                <Input readOnly value={inviteUrl} className="font-mono text-xs" />
                <Button type="button" variant="outline" size="icon" onClick={() => void copy()}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button type="button" onClick={() => void handleGenerate()} disabled={createLink.isPending}>
            {createLink.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t('inviteGenerate')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
