'use client';

import { useState, useMemo, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { usePublishToBirzha } from '@/hooks/api/useProjects';
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

/** Birzha posts require 1–99; project may store 0 or unset before first publish. */
function clampInvestorSharePercent(pct: number | undefined | null): number {
  if (pct == null || Number.isNaN(pct) || pct < 1) {
    return 20;
  }
  return Math.min(99, pct);
}

interface PublishToBirzhaDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultInvestorSharePercent?: number;
}

export function PublishToBirzhaDialog({
  projectId,
  open,
  onOpenChange,
  defaultInvestorSharePercent = 20,
}: PublishToBirzhaDialogProps) {
  const t = useTranslations('projects');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [investorSharePercent, setInvestorSharePercent] = useState(() =>
    clampInvestorSharePercent(defaultInvestorSharePercent),
  );
  const [images, setImages] = useState<string[]>([]);

  const publish = usePublishToBirzha();

  useEffect(() => {
    if (open) {
      setInvestorSharePercent(clampInvestorSharePercent(defaultInvestorSharePercent));
    }
  }, [open, defaultInvestorSharePercent]);

  const isValid = useMemo(() => content.trim().length > 0, [content]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    const share = clampInvestorSharePercent(investorSharePercent);
    publish.mutate(
      {
        projectId,
        title: title.trim() || undefined,
        content: content.trim(),
        type: images.length > 0 ? 'image' : 'text',
        images: images.length > 0 ? images : undefined,
        investorSharePercent: share,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setTitle('');
          setContent('');
          setInvestorSharePercent(clampInvestorSharePercent(defaultInvestorSharePercent));
          setImages([]);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('publishToBirzhaTitle', { defaultValue: 'Publish to Birzha' })}</DialogTitle>
          <DialogDescription>
            {t('publishToBirzhaDescription', {
              defaultValue: 'Publish this project post to the Social Investment Exchange. Post cost will be deducted from the project wallet.',
            })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="birzha-title">{t('publishBirzhaPostTitle')}</Label>
              <Input
                id="birzha-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('titlePlaceholder')}
              />
            </div>
            <div>
              <Label htmlFor="birzha-content">{t('publishBirzhaPostText')} *</Label>
              <textarea
                id="birzha-content"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
              />
            </div>
            <div>
              <Label>
                {t('investorSharePercent', { defaultValue: 'Investor share' })}: {investorSharePercent}%
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
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={publish.isPending}>
              {t('cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button type="submit" disabled={!isValid || publish.isPending}>
              {publish.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('publishing', { defaultValue: 'Publishing...' })}
                </>
              ) : (
                t('publishToBirzha', { defaultValue: 'Publish to Birzha' })
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
