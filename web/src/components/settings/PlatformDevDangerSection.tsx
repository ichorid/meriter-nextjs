'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Label } from '@/components/ui/shadcn/label';
import { Checkbox } from '@/components/ui/shadcn/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';
import { Loader2, FlaskConical, Skull, Database, Upload } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { useToastStore } from '@/shared/stores/toast.store';
import { resolveApiErrorToastMessage } from '@/lib/i18n/api-error-toast';

const WIPE_CONFIRM_TOKEN = 'WIPE';
/** Must match `PLATFORM_WIPE_EXTRA_PASSWORD` in API `platform-dev.constants.ts`. */
const PLATFORM_WIPE_EXTRA_PASSWORD = '1243';
const WIPE_COUNTDOWN_SEC = 12;
const SEED_COUNTDOWN_SEC = 3;
const DUMP_COUNTDOWN_SEC = 5;
const RESTORE_COUNTDOWN_SEC = 12;
/** Must match `DATABASE_RESTORE_CONFIRM_TOKEN` in API. */
const RESTORE_CONFIRM_TOKEN = 'RESTORE';

export function PlatformDevDangerSection() {
  const t = useTranslations('settings');
  const addToast = useToastStore((s) => s.addToast);
  const utils = trpc.useUtils();

  const [wipeOpen, setWipeOpen] = useState(false);
  const [wipeSeconds, setWipeSeconds] = useState(WIPE_COUNTDOWN_SEC);
  const [wipePhrase, setWipePhrase] = useState('');
  const [wipePassword, setWipePassword] = useState('');

  const [seedOpen, setSeedOpen] = useState(false);
  const [seedSeconds, setSeedSeconds] = useState(SEED_COUNTDOWN_SEC);
  const [seedAckWipe, setSeedAckWipe] = useState(false);

  const [dumpOpen, setDumpOpen] = useState(false);
  const [dumpSeconds, setDumpSeconds] = useState(DUMP_COUNTDOWN_SEC);
  const [dumpPassword, setDumpPassword] = useState('');

  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreSeconds, setRestoreSeconds] = useState(RESTORE_COUNTDOWN_SEC);
  const [restorePhrase, setRestorePhrase] = useState('');
  const [restorePassword, setRestorePassword] = useState('');
  const [restoreDumpJson, setRestoreDumpJson] = useState<string | null>(null);
  const restoreFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!wipeOpen) {
      setWipeSeconds(WIPE_COUNTDOWN_SEC);
      setWipePhrase('');
      setWipePassword('');
      return;
    }
    setWipeSeconds(WIPE_COUNTDOWN_SEC);
    const tmr = window.setInterval(() => {
      setWipeSeconds((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(tmr);
  }, [wipeOpen]);

  useEffect(() => {
    if (!seedOpen) {
      setSeedSeconds(SEED_COUNTDOWN_SEC);
      setSeedAckWipe(false);
      return;
    }
    setSeedSeconds(SEED_COUNTDOWN_SEC);
    const tmr = window.setInterval(() => {
      setSeedSeconds((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(tmr);
  }, [seedOpen]);

  useEffect(() => {
    if (!dumpOpen) {
      setDumpSeconds(DUMP_COUNTDOWN_SEC);
      setDumpPassword('');
      return;
    }
    setDumpSeconds(DUMP_COUNTDOWN_SEC);
    const tmr = window.setInterval(() => {
      setDumpSeconds((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(tmr);
  }, [dumpOpen]);

  useEffect(() => {
    if (!restoreOpen) {
      setRestoreSeconds(RESTORE_COUNTDOWN_SEC);
      setRestorePhrase('');
      setRestorePassword('');
      setRestoreDumpJson(null);
      if (restoreFileInputRef.current) restoreFileInputRef.current.value = '';
      return;
    }
    setRestoreSeconds(RESTORE_COUNTDOWN_SEC);
    const tmr = window.setInterval(() => {
      setRestoreSeconds((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(tmr);
  }, [restoreOpen]);

  const wipeMutation = trpc.platformDev.wipeUserContent.useMutation({
    onSuccess: async (data) => {
      await Promise.all([
        utils.users.getMe.invalidate(),
        utils.communities.getAll.invalidate(),
        utils.publications.getAll.invalidate(),
        utils.wallets.getAll.invalidate(),
        utils.notifications.getUnreadCount.invalidate(),
      ]);
      addToast(
        t('platformDevWipeSuccess', { count: String(data.superadminCount) }),
        'success',
      );
      setWipeOpen(false);
    },
    onError: (e) => addToast(resolveApiErrorToastMessage(e.message), 'error'),
  });

  const seedMutation = trpc.platformDev.seedDemoWorld.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.users.getMe.invalidate(),
        utils.communities.getAll.invalidate(),
        utils.publications.getAll.invalidate(),
        utils.wallets.getAll.invalidate(),
        utils.platformSettings.get.invalidate(),
      ]);
      addToast(t('platformDevSeedSuccess'), 'success');
      setSeedOpen(false);
    },
    onError: (e) => addToast(resolveApiErrorToastMessage(e.message), 'error'),
  });

  const exportDumpMutation = trpc.platformDev.exportDatabaseDump.useMutation({
    onSuccess: (data) => {
      const blob = new Blob([data.json], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meriter-db-dump-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      addToast(t('platformDevDumpSuccess'), 'success');
      setDumpOpen(false);
    },
    onError: (e) => addToast(resolveApiErrorToastMessage(e.message), 'error'),
  });

  const restoreDumpMutation = trpc.platformDev.restoreDatabaseDump.useMutation({
    onSuccess: async (data) => {
      await Promise.all([
        utils.users.getMe.invalidate(),
        utils.communities.getAll.invalidate(),
        utils.communities.getById.invalidate(),
        utils.publications.getAll.invalidate(),
        utils.wallets.getAll.invalidate(),
        utils.platformSettings.get.invalidate(),
        utils.notifications.getUnreadCount.invalidate(),
      ]);
      addToast(
        t('platformDevRestoreSuccess', {
          collections: String(data.collectionsRestored),
          documents: String(data.documentsInserted),
        }),
        'success',
      );
      setRestoreOpen(false);
    },
    onError: (e) => addToast(resolveApiErrorToastMessage(e.message), 'error'),
  });

  const wipeEnabled =
    wipeSeconds === 0 &&
    wipePhrase.trim().toUpperCase() === WIPE_CONFIRM_TOKEN &&
    wipePassword === PLATFORM_WIPE_EXTRA_PASSWORD &&
    !wipeMutation.isPending;

  const dumpEnabled =
    dumpSeconds === 0 &&
    dumpPassword === PLATFORM_WIPE_EXTRA_PASSWORD &&
    !exportDumpMutation.isPending;

  const restoreEnabled =
    restoreSeconds === 0 &&
    restorePhrase.trim().toUpperCase() === RESTORE_CONFIRM_TOKEN &&
    restorePassword === PLATFORM_WIPE_EXTRA_PASSWORD &&
    !!restoreDumpJson &&
    !restoreDumpMutation.isPending;

  return (
    <div className="space-y-6 border-t border-base-300 pt-6">
      <div className="rounded-lg border border-error/40 bg-error/5 p-4 space-y-2">
        <div className="flex items-center gap-2 font-semibold text-error">
          <Skull className="w-4 h-4 shrink-0" />
          {t('platformDevDangerTitle')}
        </div>
        <p className="text-xs text-base-content/70">{t('platformDevDangerIntro')}</p>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => setWipeOpen(true)}
          >
            {t('platformDevWipeOpen')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSeedOpen(true)}
            className="border-warning text-warning hover:bg-warning/10"
          >
            <FlaskConical className="w-4 h-4 mr-1" />
            {t('platformDevSeedOpen')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDumpOpen(true)}
            className="border-base-300"
          >
            <Database className="w-4 h-4 mr-1" />
            {t('platformDevDumpOpen')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRestoreOpen(true)}
            className="border-error/60 text-error hover:bg-error/10"
          >
            <Upload className="w-4 h-4 mr-1" />
            {t('platformDevRestoreOpen')}
          </Button>
        </div>
      </div>

      <Dialog open={wipeOpen} onOpenChange={setWipeOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-error">{t('platformDevWipeDialogTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-base-content/80">
            <p>{t('platformDevWipeWarning1')}</p>
            <p>{t('platformDevWipeWarning2')}</p>
            <p className="font-medium text-error">{t('platformDevWipeWarningProd')}</p>
            <div>
              <Label htmlFor="wipe-confirm">{t('platformDevWipeTypeLabel', { token: WIPE_CONFIRM_TOKEN })}</Label>
              <Input
                id="wipe-confirm"
                value={wipePhrase}
                onChange={(e) => setWipePhrase(e.target.value)}
                autoComplete="off"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="wipe-password">{t('platformDevWipePasswordLabel')}</Label>
              <Input
                id="wipe-password"
                type="password"
                inputMode="numeric"
                value={wipePassword}
                onChange={(e) => setWipePassword(e.target.value)}
                autoComplete="new-password"
                className="mt-1"
              />
              <p className="text-xs text-base-content/60 mt-1">{t('platformDevWipePasswordHelp')}</p>
            </div>
            <p className="text-xs text-base-content/60">
              {t('platformDevWipeTimer', { seconds: wipeSeconds })}
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setWipeOpen(false)}>
              {t('platformDevCancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!wipeEnabled}
              onClick={() => wipeMutation.mutate({ wipePassword })}
            >
              {wipeMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                t('platformDevWipeConfirm')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={seedOpen} onOpenChange={setSeedOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('platformDevSeedDialogTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-base-content/80">
            <p>{t('platformDevSeedHelp')}</p>
            <div className="flex items-center gap-2">
              <Checkbox
                id="seed-ack"
                checked={seedAckWipe}
                onCheckedChange={(v) => setSeedAckWipe(v === true)}
              />
              <Label htmlFor="seed-ack" className="text-sm font-normal cursor-pointer">
                {t('platformDevSeedAckWipe')}
              </Label>
            </div>
            <p className="text-xs text-base-content/60">
              {t('platformDevSeedTimer', { seconds: seedSeconds })}
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setSeedOpen(false)}>
              {t('platformDevCancel')}
            </Button>
            <Button
              type="button"
              disabled={
                seedSeconds > 0 || !seedAckWipe || seedMutation.isPending
              }
              onClick={() => seedMutation.mutate({})}
            >
              {seedMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                t('platformDevSeedConfirm')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dumpOpen} onOpenChange={setDumpOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('platformDevDumpDialogTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-base-content/80">
            <p>{t('platformDevDumpIntro')}</p>
            <div>
              <Label htmlFor="dump-password">{t('platformDevWipePasswordLabel')}</Label>
              <Input
                id="dump-password"
                type="password"
                inputMode="numeric"
                value={dumpPassword}
                onChange={(e) => setDumpPassword(e.target.value)}
                autoComplete="new-password"
                className="mt-1"
              />
              <p className="text-xs text-base-content/60 mt-1">{t('platformDevWipePasswordHelp')}</p>
            </div>
            <p className="text-xs text-base-content/60">
              {t('platformDevDumpTimer', { seconds: dumpSeconds })}
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDumpOpen(false)}>
              {t('platformDevCancel')}
            </Button>
            <Button
              type="button"
              disabled={!dumpEnabled}
              onClick={() => exportDumpMutation.mutate({ wipePassword: dumpPassword })}
            >
              {exportDumpMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                t('platformDevDumpConfirm')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={restoreOpen} onOpenChange={setRestoreOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-error">{t('platformDevRestoreDialogTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-base-content/80">
            <p>{t('platformDevRestoreWarning1')}</p>
            <p className="font-medium text-error">{t('platformDevRestoreWarning2')}</p>
            <div>
              <Label htmlFor="restore-confirm">
                {t('platformDevRestoreTypeLabel', { token: RESTORE_CONFIRM_TOKEN })}
              </Label>
              <Input
                id="restore-confirm"
                value={restorePhrase}
                onChange={(e) => setRestorePhrase(e.target.value)}
                autoComplete="off"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="restore-password">{t('platformDevWipePasswordLabel')}</Label>
              <Input
                id="restore-password"
                type="password"
                inputMode="numeric"
                value={restorePassword}
                onChange={(e) => setRestorePassword(e.target.value)}
                autoComplete="new-password"
                className="mt-1"
              />
              <p className="text-xs text-base-content/60 mt-1">{t('platformDevWipePasswordHelp')}</p>
            </div>
            <div>
              <Label htmlFor="restore-file">{t('platformDevRestoreFileLabel')}</Label>
              <Input
                id="restore-file"
                ref={restoreFileInputRef}
                type="file"
                accept="application/json,.json"
                className="mt-1 cursor-pointer"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) {
                    setRestoreDumpJson(null);
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => {
                    setRestoreDumpJson(
                      typeof reader.result === 'string' ? reader.result : null,
                    );
                  };
                  reader.readAsText(f);
                }}
              />
            </div>
            <p className="text-xs text-base-content/60">
              {t('platformDevRestoreTimer', { seconds: restoreSeconds })}
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setRestoreOpen(false)}>
              {t('platformDevCancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!restoreEnabled}
              onClick={() => {
                if (!restoreDumpJson) return;
                restoreDumpMutation.mutate({
                  wipePassword: restorePassword,
                  confirmPhrase: RESTORE_CONFIRM_TOKEN,
                  dumpJson: restoreDumpJson,
                });
              }}
            >
              {restoreDumpMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                t('platformDevRestoreConfirm')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
