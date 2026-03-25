'use client';

import { BirzhaPublishDialog } from '@/components/organisms/Birzha/BirzhaPublishDialog';

interface PublishToBirzhaDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PublishToBirzhaDialog({
  projectId,
  open,
  onOpenChange,
}: PublishToBirzhaDialogProps) {
  return (
    <BirzhaPublishDialog
      sourceEntityType="project"
      sourceEntityId={projectId}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}
