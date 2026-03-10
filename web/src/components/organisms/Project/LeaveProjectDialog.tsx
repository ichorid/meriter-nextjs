'use client';

import { useTranslations } from 'next-intl';
import { useLeaveProject } from '@/hooks/api/useProjects';
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

interface LeaveProjectDialogProps {
  projectId: string;
  projectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  /** Optional: show warning about in-progress/done tickets */
  hasTicketsWarning?: boolean;
}

export function LeaveProjectDialog({
  projectId,
  projectName,
  open,
  onOpenChange,
  onSuccess,
  hasTicketsWarning = false,
}: LeaveProjectDialogProps) {
  const t = useTranslations('projects');
  const leaveProject = useLeaveProject();

  const handleLeave = () => {
    leaveProject.mutate(
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
          <DialogTitle>{t('leaveProjectTitle', { defaultValue: 'Leave project' })}</DialogTitle>
          <DialogDescription>
            {t('leaveProjectDescription', {
              defaultValue: 'You will be removed from the project. Tickets assigned to you will be reopened or closed as completed.',
            })}
          </DialogDescription>
        </DialogHeader>
        {hasTicketsWarning && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>
              {t('leaveTicketsWarning', {
                defaultValue: 'You have tickets in progress or done. In-progress tickets will be reopened; done tickets will be marked closed.',
              })}
            </span>
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          &quot;{projectName}&quot; — {t('leaveConfirm', { defaultValue: 'Leave anyway?' })}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={leaveProject.isPending}>
            {t('cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button variant="destructive" onClick={handleLeave} disabled={leaveProject.isPending}>
            {leaveProject.isPending ? t('leaving', { defaultValue: 'Leaving…' }) : t('leaveProject', { defaultValue: 'Leave project' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
