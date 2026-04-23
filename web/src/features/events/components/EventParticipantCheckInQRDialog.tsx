'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';
import { Button } from '@/components/ui/shadcn/button';
import { Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';

const QRCodeSVG = dynamic(() => import('qrcode.react').then((m) => m.QRCodeSVG), { ssr: false });

export interface EventParticipantCheckInQRDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  publicationId: string;
}

export function EventParticipantCheckInQRDialog({
  open,
  onOpenChange,
  publicationId,
}: EventParticipantCheckInQRDialogProps) {
  const t = useTranslations('events');
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);

  const issue = trpc.events.issueMyCheckInToken.useMutation({
    onSuccess: (data) => {
      setToken(data.token);
      setExpiresAt(new Date(data.expiresAt));
    },
    onError: () => {
      setToken(null);
      setExpiresAt(null);
    },
  });

  useEffect(() => {
    if (!open) {
      setToken(null);
      setExpiresAt(null);
      return;
    }
    setToken(null);
    setExpiresAt(null);
    issue.mutate({ publicationId });
    // tRPC mutation instance is stable; avoid re-running on unrelated renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, publicationId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('checkInQrTitle')}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          {issue.isPending || !token ? (
            <div className="flex flex-col items-center gap-2 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-brand-primary" aria-hidden />
              <p className="text-sm text-base-content/60">{t('checkInQrLoading')}</p>
            </div>
          ) : (
            <>
              <div className="rounded-lg bg-white p-3">
                <QRCodeSVG value={token} size={220} level="M" />
              </div>
              {expiresAt ? (
                <p className="text-center text-xs text-base-content/70">
                  {t('checkInQrExpires', {
                    time: expiresAt.toLocaleString(undefined, {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    }),
                  })}
                </p>
              ) : null}
              <Button type="button" variant="outline" size="sm" onClick={() => issue.mutate({ publicationId })}>
                {t('checkInQrRefresh')}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
