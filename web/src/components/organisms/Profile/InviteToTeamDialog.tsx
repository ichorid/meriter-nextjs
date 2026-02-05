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
import { useInviteToTeam } from '@/hooks/api/useTeams';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Community } from '@/types/api-v1';

interface InviteToTeamDialogProps {
  open: boolean;
  onClose: () => void;
  targetUserId: string;
  communities: Community[];
}

export function InviteToTeamDialog({
  open,
  onClose,
  targetUserId,
  communities,
}: InviteToTeamDialogProps) {
  const tCommon = useTranslations('common');
  const inviteToTeam = useInviteToTeam();
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(
    null,
  );

  const handleInvite = async () => {
    if (!selectedCommunityId) return;

    try {
      await inviteToTeam.mutateAsync({
        targetUserId,
        communityId: selectedCommunityId,
      });
      setSelectedCommunityId(null);
      onClose();
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const handleClose = () => {
    if (!inviteToTeam.isPending) {
      setSelectedCommunityId(null);
      onClose();
    }
  };

  if (communities.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Выберите команду</DialogTitle>
          <DialogDescription>
            Пользователю будет отправлено приглашение в выбранную команду. Он сможет принять или отклонить его.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-4 max-h-[300px] overflow-y-auto">
          {communities.map((community) => (
            <div
              key={community.id}
              className={cn(
                'p-3 border rounded-xl cursor-pointer transition-colors',
                selectedCommunityId === community.id
                  ? 'border-primary bg-primary/10'
                  : 'border-base-300 hover:bg-base-200',
              )}
              onClick={() =>
                !inviteToTeam.isPending &&
                setSelectedCommunityId(community.id)
              }
            >
              <div className="font-medium text-base-content">
                {community.name}
              </div>
              {community.description && (
                <div className="text-sm text-base-content/60 mt-1">
                  {community.description}
                </div>
              )}
            </div>
          ))}
        </div>

        <DialogFooter className="flex justify-end gap-3 pt-4 border-t border-base-content/10">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={inviteToTeam.isPending}
            className="rounded-xl"
          >
            {tCommon('cancel', { defaultValue: 'Отмена' })}
          </Button>
          <Button
            onClick={handleInvite}
            disabled={!selectedCommunityId || inviteToTeam.isPending}
            className="rounded-xl"
          >
            {inviteToTeam.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Пригласить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

