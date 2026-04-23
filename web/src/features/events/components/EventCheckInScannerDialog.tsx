'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';
import { Button } from '@/components/ui/shadcn/button';
import { trpc } from '@/lib/trpc/client';
import { useToastStore } from '@/shared/stores/toast.store';
import { resolveApiErrorToastMessage } from '@/lib/i18n/api-error-toast';

export interface EventCheckInScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  publicationId: string;
  communityId: string;
}

export function EventCheckInScannerDialog({
  open,
  onOpenChange,
  publicationId,
  communityId,
}: EventCheckInScannerDialogProps) {
  const t = useTranslations('events');
  const addToast = useToastStore((s) => s.addToast);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [manualToken, setManualToken] = useState('');
  const [scanning, setScanning] = useState(false);
  const utils = trpc.useUtils();

  const checkIn = trpc.events.checkInByToken.useMutation({
    onSuccess: async () => {
      addToast(t('scanQrSuccess'), 'success');
      await utils.publications.getById.invalidate({ id: publicationId });
      await utils.events.getEventsByCommunity.invalidate({ communityId });
      onOpenChange(false);
    },
    onError: (e) => {
      addToast(resolveApiErrorToastMessage(e.message), 'error');
    },
  });

  const stopStream = useCallback(() => {
    const v = videoRef.current;
    if (v?.srcObject) {
      const stream = v.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      v.srcObject = null;
    }
  }, []);

  useEffect(() => {
    if (!open) {
      stopStream();
      setScanning(false);
      setManualToken('');
    }
  }, [open, stopStream]);

  const startCameraScan = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();
      setScanning(true);
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const reader = new BrowserMultiFormatReader();
      const result = await reader.decodeOnceFromVideoElement(video);
      const text = result.getText().trim();
      if (text) {
        await checkIn.mutateAsync({ token: text });
      }
    } catch (e) {
      if (!checkIn.isPending) {
        addToast(e instanceof Error ? e.message : t('scanQrCameraError'), 'error');
      }
    } finally {
      stopStream();
      setScanning(false);
    }
  };

  const submitManual = async () => {
    const tok = manualToken.trim();
    if (!tok) return;
    await checkIn.mutateAsync({ token: tok });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('scanQrTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-base-content/70">{t('scanQrHint')}</p>
          <video ref={videoRef} className="aspect-video w-full rounded-lg bg-black object-cover" muted playsInline />
          <Button
            type="button"
            className="w-full"
            disabled={scanning || checkIn.isPending}
            onClick={() => void startCameraScan()}
          >
            {scanning ? t('scanQrScanning') : t('scanQrStartCamera')}
          </Button>
          <div className="space-y-2">
            <label className="text-xs font-medium text-base-content/80" htmlFor="checkin-token-manual">
              {t('scanQrManualLabel')}
            </label>
            <textarea
              id="checkin-token-manual"
              className="min-h-[72px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              placeholder={t('scanQrManualPlaceholder')}
            />
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={checkIn.isPending || !manualToken.trim()}
              onClick={() => void submitManual()}
            >
              {t('scanQrSubmitManual')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
