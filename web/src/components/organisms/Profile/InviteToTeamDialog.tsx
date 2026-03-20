'use client';

import React, { useState, useEffect } from 'react';
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
import { Label } from '@/components/ui/shadcn/label';
import { Textarea } from '@/components/ui/shadcn/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/shadcn/select';
import { useInviteToTeam } from '@/hooks/api/useTeams';
import { Loader2 } from 'lucide-react';
import type { Community } from '@/types/api-v1';

const COMMENT_MAX = 500;

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
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const inviteToTeam = useInviteToTeam();
  const [selectedCommunityId, setSelectedCommunityId] = useState<string>('');
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (!open) {
      setSelectedCommunityId('');
      setComment('');
    }
  }, [open]);

  const handleInvite = async () => {
    if (!selectedCommunityId) return;

    try {
      const trimmed = comment.trim();
      await inviteToTeam.mutateAsync({
        targetUserId,
        communityId: selectedCommunityId,
        ...(trimmed ? { inviterMessage: trimmed } : {}),
      });
      onClose();
    } catch {
      // Toast from hook
    }
  };

  const handleClose = () => {
    if (!inviteToTeam.isPending) {
      onClose();
    }
  };

  if (communities.length === 0) {
    return (
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('inviteToTeamDialogTitle')}</DialogTitle>
            <DialogDescription>{t('inviteToTeamNoCommunities')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleClose} className="rounded-xl">
              {tCommon('close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('inviteToTeamDialogTitle')}</DialogTitle>
          <DialogDescription>{t('inviteToTeamDialogDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="invite-community-select">{t('inviteSelectCommunityLabel')}</Label>
            <Select
              value={selectedCommunityId || undefined}
              onValueChange={setSelectedCommunityId}
              disabled={inviteToTeam.isPending}
            >
              <SelectTrigger id="invite-community-select" className="rounded-xl w-full">
                <SelectValue placeholder={t('inviteSelectCommunityPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {communities.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-comment">{t('inviteCommentLabel')}</Label>
            <Textarea
              id="invite-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, COMMENT_MAX))}
              placeholder={t('inviteCommentPlaceholder')}
              disabled={inviteToTeam.isPending}
              rows={4}
              className="rounded-xl resize-y min-h-[96px]"
            />
            <p className="text-xs text-base-content/50 text-right">
              {comment.length}/{COMMENT_MAX}
            </p>
          </div>
        </div>

        <DialogFooter className="flex justify-end gap-3 pt-4 border-t border-base-content/10">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={inviteToTeam.isPending}
            className="rounded-xl"
          >
            {tCommon('cancel')}
          </Button>
          <Button
            onClick={() => void handleInvite()}
            disabled={!selectedCommunityId || inviteToTeam.isPending}
            className="rounded-xl"
          >
            {inviteToTeam.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {t('inviteButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
