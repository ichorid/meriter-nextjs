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
import { useAssignLead } from '@/hooks/api/useTeams';
import { useCommunities } from '@/hooks/api/useCommunities';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/shadcn/badge';

interface AssignLeadDialogProps {
  open: boolean;
  onClose: () => void;
  targetUserId: string;
}

export function AssignLeadDialog({
  open,
  onClose,
  targetUserId,
}: AssignLeadDialogProps) {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const assignLead = useAssignLead();
  const { data: allCommunitiesData, isLoading: communitiesLoading } =
    useCommunities();
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(
    null,
  );

  const allCommunities = allCommunitiesData?.data || [];

  const handleAssign = async () => {
    if (!selectedCommunityId) return;

    try {
      await assignLead.mutateAsync({
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
    if (!assignLead.isPending) {
      setSelectedCommunityId(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Назначить лидом</DialogTitle>
          <DialogDescription>
            Выберите сообщество, в котором пользователь станет лидом.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-4 max-h-[300px] overflow-y-auto">
          {communitiesLoading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : allCommunities.length === 0 ? (
            <div className="text-center py-8 text-base-content/60">
              Нет доступных сообществ
            </div>
          ) : (
            allCommunities.map((community) => (
              <div
                key={community.id}
                className={cn(
                  'p-3 border rounded-xl cursor-pointer transition-colors',
                  selectedCommunityId === community.id
                    ? 'border-primary bg-primary/10'
                    : 'border-base-300 hover:bg-base-200',
                )}
                onClick={() =>
                  !assignLead.isPending && setSelectedCommunityId(community.id)
                }
              >
                <div className="flex items-center gap-2">
                  <div className="font-medium text-base-content">
                    {community.name}
                  </div>
                  {community.typeTag &&
                    ['future-vision', 'marathon-of-good', 'support', 'team-projects'].includes(
                      community.typeTag,
                    ) && (
                      <Badge variant="secondary" className="text-xs">
                        Глобальное
                      </Badge>
                    )}
                </div>
                {community.description && (
                  <div className="text-sm text-base-content/60 mt-1">
                    {community.description}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <DialogFooter className="flex justify-end gap-3 pt-4 border-t border-base-content/10">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={assignLead.isPending}
            className="rounded-xl"
          >
            {tCommon('cancel')}
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!selectedCommunityId || assignLead.isPending}
            className="rounded-xl"
          >
            {assignLead.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {t('assignLeadButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


