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
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreateTeamDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CreateTeamDialog({ open, onClose }: CreateTeamDialogProps) {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const createTeam = useCreateTeam();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = async () => {
    if (!name.trim()) return;

    try {
      await createTeam.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      // Reset form
      setName('');
      setDescription('');
      onClose();
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const handleClose = () => {
    if (!createTeam.isPending) {
      setName('');
      setDescription('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Создать команду</DialogTitle>
          <DialogDescription>
            Создайте новую команду. Вы автоматически станете её лидом.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label htmlFor="team-name" className="text-sm font-medium">
              Название команды <span className="text-error">*</span>
            </label>
            <Input
              id="team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Моя команда"
              maxLength={100}
              disabled={createTeam.isPending}
              className="rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="team-description" className="text-sm font-medium">
              Описание (опционально)
            </label>
            <Textarea
              id="team-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Расскажите о команде..."
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
            {tCommon('cancel', { defaultValue: 'Отмена' })}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || createTeam.isPending}
            className="rounded-xl"
          >
            {createTeam.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Создать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


