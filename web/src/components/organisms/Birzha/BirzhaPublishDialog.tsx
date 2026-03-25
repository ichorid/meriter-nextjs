'use client';

import { useState, useMemo, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { usePublishToBirzhaSource } from '@/hooks/api/useBirzhaSource';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';
import { Button } from '@/components/ui/shadcn/button';
import { Label } from '@/components/ui/shadcn/label';
import { Input } from '@/components/ui/shadcn/input';
import { Slider } from '@/components/ui/slider';
import { Loader2 } from 'lucide-react';

function clampInvestorSharePercent(pct: number | undefined | null): number {
  if (pct == null || Number.isNaN(pct) || pct < 1) {
    return 20;
  }
  return Math.min(99, pct);
}

export interface BirzhaPublishDialogProps {
  sourceEntityType: 'project' | 'community';
  sourceEntityId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Shown in description; optional avatar not used in dialog v1 */
  displayName?: string;
  /** When true (project only), show investor share slider */
  showInvestorShareSlider?: boolean;
  defaultInvestorSharePercent?: number;
}

export function BirzhaPublishDialog({
  sourceEntityType,
  sourceEntityId,
  open,
  onOpenChange,
  displayName,
  showInvestorShareSlider = false,
  defaultInvestorSharePercent = 20,
}: BirzhaPublishDialogProps) {
  const t = useTranslations('birzhaSource');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [investorSharePercent, setInvestorSharePercent] = useState(() =>
    clampInvestorSharePercent(defaultInvestorSharePercent),
  );

  const publish = usePublishToBirzhaSource({ sourceEntityType, sourceEntityId });

  useEffect(() => {
    if (open) {
      setInvestorSharePercent(clampInvestorSharePercent(defaultInvestorSharePercent));
    }
  }, [open, defaultInvestorSharePercent]);

  const isValid = useMemo(
    () => title.trim().length > 0 && content.trim().length > 0,
    [title, content],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    const share = clampInvestorSharePercent(investorSharePercent);
    publish.mutate(
      {
        title: title.trim(),
        content: content.trim(),
        type: 'text',
        ...(showInvestorShareSlider ? { investorSharePercent: share } : {}),
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setTitle('');
          setContent('');
          setInvestorSharePercent(clampInvestorSharePercent(defaultInvestorSharePercent));
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('publishTitle')}</DialogTitle>
          <DialogDescription>
            {displayName
              ? t('publishDescriptionNamed', { name: displayName })
              : t('publishDescription')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="birzha-src-title">{t('postTitle')} *</Label>
              <Input
                id="birzha-src-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('postTitlePlaceholder')}
                required
                maxLength={500}
              />
            </div>
            <div>
              <Label htmlFor="birzha-src-content">{t('postBody')} *</Label>
              <textarea
                id="birzha-src-content"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
              />
            </div>
            {showInvestorShareSlider ? (
              <div>
                <Label>
                  {t('investorSharePercent')}: {investorSharePercent}%
                </Label>
                <Slider
                  value={[investorSharePercent]}
                  onValueChange={([v]) =>
                    setInvestorSharePercent(clampInvestorSharePercent(v ?? 20))
                  }
                  min={1}
                  max={99}
                  step={1}
                  className="mt-2"
                />
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={publish.isPending}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={!isValid || publish.isPending}>
              {publish.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('publishing')}
                </>
              ) : (
                t('publishCta')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
