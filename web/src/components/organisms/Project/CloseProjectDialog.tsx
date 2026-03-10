'use client';

import { useTranslations } from 'next-intl';
import { useCloseProject } from '@/hooks/api/useProjects';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';
import { Button } from '@/components/ui/shadcn/button';
import { AlertTriangle } from 'lucide-react';

interface CloseProjectDialogProps {
  projectId: string;
  projectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CloseProjectDialog({
  projectId,
  projectName,
  open,
  onOpenChange,
  onSuccess,
}: CloseProjectDialogProps) {
  const t = useTranslations('projects');
  const closeProject = useCloseProject();

  const handleClose = () => {
    closeProject.mutate(
      { projectId },
      {
        onSuccess: () => {
          onOpenChange(false);
          onSuccess?.();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('closeProjectTitle', { defaultValue: 'Close project' })}</DialogTitle>
          <DialogDescription>
            {t('closeProjectDescription', {
              defaultValue:
                'Closing the project will close all project reports published to the exchange and archive the project. This cannot be undone.',
            })}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>
            {t('closeProjectWarning', {
              defaultValue: 'All reports from this project on the exchange will be closed and merits distributed. The project will become read-only.',
            })}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          &quot;{projectName}&quot; — {t('closeConfirm', { defaultValue: 'Confirm close?' })}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={closeProject.isPending}>
            {t('cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button variant="destructive" onClick={handleClose} disabled={closeProject.isPending}>
            {closeProject.isPending ? t('closing', { defaultValue: 'Closing…' }) : t('closeProject', { defaultValue: 'Close project' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
