'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useUpdateShares } from '@/hooks/api/useProjects';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';
import { Button } from '@/components/ui/shadcn/button';
import { Slider } from '@/components/ui/slider';
import { Loader2 } from 'lucide-react';

interface UpdateSharesDialogProps {
  projectId: string;
  projectName?: string;
  currentFounderSharePercent: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function UpdateSharesDialog({
  projectId,
  currentFounderSharePercent,
  open,
  onOpenChange,
  onSuccess,
}: UpdateSharesDialogProps) {
  const t = useTranslations('projects');
  const [value, setValue] = useState(currentFounderSharePercent);
  const updateShares = useUpdateShares();

  const canDecrease = useMemo(() => value < currentFounderSharePercent && value >= 0, [value, currentFounderSharePercent]);
  const isValid = useMemo(() => value >= 0 && value <= 100 && value < currentFounderSharePercent, [value, currentFounderSharePercent]);

  const handleSubmit = () => {
    if (!isValid) return;
    updateShares.mutate(
      { projectId, newFounderSharePercent: value },
      {
        onSuccess: () => {
          onOpenChange(false);
          onSuccess?.();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('updateSharesTitle', { defaultValue: 'Update founder share' })}</DialogTitle>
          <DialogDescription>
            {t('updateSharesDescription', {
              defaultValue: 'You can only decrease the founder share (increase the team share). Current: {current}%.',
              values: { current: currentFounderSharePercent },
            })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium">{t('founderShare', { defaultValue: 'Founder share' })}</span>
            <span className="text-sm tabular-nums">{value}%</span>
          </div>
          <Slider
            value={[value]}
            onValueChange={([v]) => setValue(v ?? 0)}
            min={0}
            max={Math.max(0, currentFounderSharePercent - 1)}
            step={1}
            className="w-full"
          />
          {!canDecrease && value >= currentFounderSharePercent && (
            <p className="text-xs text-muted-foreground">
              {t('onlyDecrease', { defaultValue: 'Only decrease is allowed.' })}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={updateShares.isPending}>
            {t('cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || updateShares.isPending}>
            {updateShares.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('saveShares', { defaultValue: 'Save' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
