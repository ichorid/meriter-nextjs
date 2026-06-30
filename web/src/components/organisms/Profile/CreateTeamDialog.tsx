'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/shadcn/dialog';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Textarea } from '@/components/ui/shadcn/textarea';
import { useCreateTeam } from '@/hooks/api/useTeams';
import { useFutureVisionTags } from '@/hooks/api/useFutureVisions';
import { ImageUploader } from '@/components/ui/ImageUploader/ImageUploader';
import { FutureVisionCoverDevPlaceholders } from '@/shared/components/FutureVisionCoverDevPlaceholders';
import { Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/shadcn/checkbox';

interface CreateTeamDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CreateTeamDialog({ open, onClose }: CreateTeamDialogProps) {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const tProjects = useTranslations('projects');
  const createTeam = useCreateTeam();
  const { data: platformSettings } = useFutureVisionTags();
  const availableTags = platformSettings?.availableFutureVisionTags ?? [];

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [futureVisionText, setFutureVisionText] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [futureVisionCover, setFutureVisionCover] = useState('');

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    const trimmedFutureVision = futureVisionText.trim();
    if (!trimmedName || !trimmedFutureVision) return;

    try {
      await createTeam.mutateAsync({
        name: trimmedName,
        description: description.trim() || undefined,
        futureVisionText: trimmedFutureVision,
        futureVisionTags: selectedTags.length > 0 ? selectedTags : undefined,
        futureVisionCover: futureVisionCover.trim() || undefined,
      });
      setName('');
      setDescription('');
      setFutureVisionText('');
      setSelectedTags([]);
      setFutureVisionCover('');
      onClose();
    } catch {
      // Error handling is done in the hook
    }
  };

  const handleClose = () => {
    if (!createTeam.isPending) {
      setName('');
      setDescription('');
      setFutureVisionText('');
      setSelectedTags([]);
      setFutureVisionCover('');
      onClose();
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('createTeamDialogTitle')}</DialogTitle>
          <DialogDescription>
            {t('createTeamDialogDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label htmlFor="team-name" className="text-sm font-medium">
              {t('teamNameLabel')} <span className="text-error">*</span>
            </label>
            <Input
              id="team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('teamNamePlaceholder')}
              maxLength={100}
              disabled={createTeam.isPending}
              className="rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="team-future-vision" className="text-sm font-medium">
              {tProjects('futureVisionRequired')} <span className="text-error">*</span>
            </label>
            <Textarea
              id="team-future-vision"
              value={futureVisionText}
              onChange={(e) => setFutureVisionText(e.target.value)}
              placeholder={tProjects('futureVisionPlaceholder')}
              maxLength={10000}
              disabled={createTeam.isPending}
              className="rounded-xl min-h-[80px]"
            />
          </div>

          {availableTags.length > 0 && (
            <div className="space-y-2">
              <span className="text-sm font-medium">{tProjects('valueTagsLabel')}</span>
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => (
                  <label key={tag} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={selectedTags.includes(tag)}
                      onCheckedChange={() => toggleTag(tag)}
                      disabled={createTeam.isPending}
                    />
                    <span className="text-sm">{tag}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <span className="text-sm font-medium">{tProjects('futureVisionCoverLabel')}</span>
            <ImageUploader
              value={futureVisionCover || undefined}
              onUpload={setFutureVisionCover}
              onRemove={() => setFutureVisionCover('')}
              disabled={createTeam.isPending}
              aspectRatio={16 / 9}
              compact
              allowUrlFallback
            />
            <FutureVisionCoverDevPlaceholders
              onSelectUrl={setFutureVisionCover}
              disabled={createTeam.isPending}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="team-description" className="text-sm font-medium">
              {t('teamDescriptionOptional')}
            </label>
            <Textarea
              id="team-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('teamDescriptionPlaceholder')}
              maxLength={1000}
              disabled={createTeam.isPending}
              className="rounded-xl min-h-[80px]"
            />
          </div>
        </div>

        <DialogFooter className="flex justify-end gap-3 pt-4 border-t border-base-content/10">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={createTeam.isPending}
            className="rounded-xl"
          >
            {tCommon('cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || !futureVisionText.trim() || createTeam.isPending}
            className="rounded-xl"
          >
            {createTeam.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {t('createTeamButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


