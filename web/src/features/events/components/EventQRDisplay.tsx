'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';

const QRCodeSVG = dynamic(() => import('qrcode.react').then((m) => m.QRCodeSVG), { ssr: false });

export interface EventQRDisplayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Full invite URL (including origin). */
  inviteUrl: string;
}

export function EventQRDisplay({ open, onOpenChange, inviteUrl }: EventQRDisplayProps) {
  const t = useTranslations('events');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('qrTitle')}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="rounded-lg bg-white p-3">
            <QRCodeSVG value={inviteUrl} size={220} level="M" />
          </div>
          <p className="break-all text-center text-xs text-base-content/70">{inviteUrl}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
