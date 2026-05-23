'use client';

import { useEffect, useState } from 'react';
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
import { Switch } from '@/components/ui/shadcn/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/shadcn/select';
import { trpc } from '@/lib/trpc/client';

export interface DocumentSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: {
    id: string;
    type: 'imageOfFuture' | 'description' | 'custom';
    title: string;
    mode: 'manual' | 'auto';
    votingDurationHours: number;
    variantCost: number;
    allowDownvotes: boolean;
  };
  onSaved?: () => void;
  onError?: (message: string) => void;
}

export function DocumentSettingsDialog({
  open,
  onOpenChange,
  document,
  onSaved,
  onError,
}: DocumentSettingsDialogProps) {
  const t = useTranslations('pages.documents.settings');
  const utils = trpc.useUtils();

  const [title, setTitle] = useState(document.title);
  const [mode, setMode] = useState<'manual' | 'auto'>(document.mode);
  const [votingDurationHours, setVotingDurationHours] = useState(
    String(document.votingDurationHours ?? 48),
  );
  const [variantCost, setVariantCost] = useState(String(document.variantCost ?? 1));
  const [allowDownvotes, setAllowDownvotes] = useState(document.allowDownvotes);

  useEffect(() => {
    if (!open) return;
    setTitle(document.title);
    setMode(document.mode);
    setVotingDurationHours(String(document.votingDurationHours ?? 48));
    setVariantCost(String(document.variantCost ?? 1));
    setAllowDownvotes(document.allowDownvotes);
  }, [open, document]);

  const updateMutation = trpc.documents.updateMeta.useMutation({
    onSuccess: async () => {
      await utils.documents.getById.invalidate({ id: document.id });
      onSaved?.();
      onOpenChange(false);
    },
    onError: (err) => {
      onError?.(err.message);
    },
  });

  const handleSubmit = () => {
    const hours = parseInt(votingDurationHours, 10);
    const cost = parseInt(variantCost, 10);
    if (!Number.isFinite(hours) || hours < 1) {
      onError?.(t('invalidVotingHours'));
      return;
    }
    if (!Number.isFinite(cost) || cost < 0) {
      onError?.(t('invalidVariantCost'));
      return;
    }
    updateMutation.mutate({
      id: document.id,
      ...(document.type === 'custom' ? { title: title.trim() } : {}),
      mode,
      votingDurationHours: hours,
      variantCost: cost,
      allowDownvotes,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-base-content/70">{t('help')}</p>

        <div className="space-y-4 py-2">
          {document.type === 'custom' ? (
            <div className="space-y-2">
              <Label htmlFor="doc-settings-title">{t('documentTitle')}</Label>
              <Input
                id="doc-settings-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="rounded-lg"
                disabled={updateMutation.isPending}
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="doc-settings-mode">{t('applyMode')}</Label>
            <Select
              value={mode}
              onValueChange={(v) => setMode(v as 'manual' | 'auto')}
              disabled={updateMutation.isPending}
            >
              <SelectTrigger id="doc-settings-mode" className="rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">{t('modeManual')}</SelectItem>
                <SelectItem value="auto">{t('modeAuto')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-settings-hours">{t('votingDurationHours')}</Label>
            <Input
              id="doc-settings-hours"
              type="number"
              min={1}
              max={720}
              value={votingDurationHours}
              onChange={(e) => setVotingDurationHours(e.target.value)}
              className="rounded-lg"
              disabled={updateMutation.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-settings-cost">{t('variantCost')}</Label>
            <Input
              id="doc-settings-cost"
              type="number"
              min={0}
              max={1000}
              value={variantCost}
              onChange={(e) => setVariantCost(e.target.value)}
              className="rounded-lg"
              disabled={updateMutation.isPending}
            />
            <p className="text-xs text-base-content/60">{t('variantCostHelp')}</p>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-base-300/60 px-3 py-2">
            <div>
              <p className="text-sm font-medium text-base-content">{t('allowDownvotes')}</p>
              <p className="text-xs text-base-content/60">{t('allowDownvotesHelp')}</p>
            </div>
            <Switch
              checked={allowDownvotes}
              onCheckedChange={setAllowDownvotes}
              disabled={updateMutation.isPending}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            className="rounded-lg"
            onClick={() => onOpenChange(false)}
            disabled={updateMutation.isPending}
          >
            {t('cancel')}
          </Button>
          <Button
            type="button"
            className="rounded-lg"
            onClick={handleSubmit}
            disabled={updateMutation.isPending}
          >
            {t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
