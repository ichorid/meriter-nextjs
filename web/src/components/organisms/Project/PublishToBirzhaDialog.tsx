'use client';

import { BirzhaPublishDialog } from '@/components/organisms/Birzha/BirzhaPublishDialog';

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
  return (
    <BirzhaPublishDialog
      sourceEntityType="project"
      sourceEntityId={projectId}
      open={open}
      onOpenChange={onOpenChange}
      showInvestorShareSlider
      defaultInvestorSharePercent={defaultInvestorSharePercent}
    />
  );
}
