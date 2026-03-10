'use client';

import { useState, useMemo } from 'react';
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
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [investorSharePercent, setInvestorSharePercent] = useState(defaultInvestorSharePercent);
  const [images, setImages] = useState<string[]>([]);

  const publish = usePublishToBirzha();

  const isValid = useMemo(() => content.trim().length > 0, [content]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    publish.mutate(
      {
        projectId,
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        content: content.trim(),
        type: images.length > 0 ? 'image' : 'text',
        images: images.length > 0 ? images : undefined,
        investorSharePercent,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setTitle('');
          setDescription('');
          setContent('');
          setInvestorSharePercent(defaultInvestorSharePercent);
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
              <Label htmlFor="birzha-title">{t('title', { defaultValue: 'Title' })}</Label>
              <Input
                id="birzha-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('titlePlaceholder', { defaultValue: 'Optional' })}
              />
            </div>
            <div>
              <Label htmlFor="birzha-description">{t('description', { defaultValue: 'Description' })}</Label>
              <Input
                id="birzha-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('descriptionPlaceholder', { defaultValue: 'Optional' })}
              />
            </div>
            <div>
              <Label htmlFor="birzha-content">{t('content', { defaultValue: 'Content' })} *</Label>
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
                onValueChange={([v]) => setInvestorSharePercent(v ?? 20)}
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
