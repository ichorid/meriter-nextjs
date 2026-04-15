'use client';

import React, { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Label } from '@/components/ui/shadcn/label';
import { Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { useCommunityMembers } from '@/hooks/api/useCommunityMembers';
import { useToastStore } from '@/shared/stores/toast.store';
import { resolveApiErrorToastMessage } from '@/lib/i18n/api-error-toast';

export interface EventDirectInviteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  publicationId: string;
  communityId: string;
}

export function EventDirectInvite({
  open,
  onOpenChange,
  publicationId,
  communityId,
}: EventDirectInviteProps) {
  const t = useTranslations('events');
  const addToast = useToastStore((s) => s.addToast);
  const [q, setQ] = useState('');
  const { data } = useCommunityMembers(communityId, { limit: 300 });
  const inviteMutation = trpc.events.inviteUser.useMutation();

  const filtered = useMemo(() => {
    const rows = data?.data ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return rows.slice(0, 30);
    return rows
      .filter(
        (m) =>
          m.displayName.toLowerCase().includes(needle) || m.username.toLowerCase().includes(needle),
      )
      .slice(0, 30);
  }, [data?.data, q]);

  const send = async (userId: string) => {
    try {
      await inviteMutation.mutateAsync({ publicationId, targetUserId: userId });
      addToast(t('directInviteSent'), 'success');
      onOpenChange(false);
    } catch (e: unknown) {
      addToast(resolveApiErrorToastMessage(e instanceof Error ? e.message : undefined), 'error');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('directInviteTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-1">
          <Label htmlFor="ev-dir-q">{t('directInviteSearch')}</Label>
          <Input
            id="ev-dir-q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('directInviteSearchPlaceholder')}
          />
        </div>
        <ul className="max-h-60 space-y-1 overflow-y-auto rounded border border-base-content/10 p-1">
          {filtered.map((m) => (
            <li key={m.id}>
              <Button
                type="button"
                variant="ghost"
                className="h-auto w-full justify-start px-2 py-2 text-left font-normal"
                disabled={inviteMutation.isPending}
                onClick={() => void send(m.id)}
              >
                <span className="font-medium">{m.displayName}</span>
                <span className="ml-2 text-xs text-base-content/60">@{m.username}</span>
              </Button>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
        </DialogFooter>
        {inviteMutation.isPending ? (
          <div className="flex justify-center py-2">
            <Loader2 className="h-5 w-5 animate-spin text-base-content/50" />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
