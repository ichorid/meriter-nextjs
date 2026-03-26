'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';
import { Loader2 } from 'lucide-react';
import { useProjectInvestmentsList } from '@/hooks/api/useProjects';
import { routes } from '@/lib/constants/routes';
import { formatMerits } from '@/lib/utils/currency';

export interface ProjectInvestorsDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectInvestorsDialog({
  projectId,
  open,
  onOpenChange,
}: ProjectInvestorsDialogProps) {
  const t = useTranslations('projects');
  const { data: rows, isLoading } = useProjectInvestmentsList(projectId, {
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('investorsDialogTitle')}</DialogTitle>
          <DialogDescription className="text-left text-sm text-base-content/80">
            {t('investorsDialogDescription')}
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-base-content/40" />
          </div>
        ) : !rows?.length ? (
          <p className="text-sm text-base-content/60 py-4">{t('investorsDialogEmpty')}</p>
        ) : (
          <ul className="space-y-2 border-t border-base-300 pt-3">
            {rows.map((row) => (
              <li
                key={row.userId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-base-300/80 bg-base-200/30 px-3 py-2 text-sm"
              >
                <Link
                  href={routes.userProfile(row.userId)}
                  className="font-medium text-base-content hover:underline min-w-0 truncate"
                >
                  {row.displayName}
                </Link>
                <div className="flex shrink-0 items-center gap-3 tabular-nums text-xs text-base-content/80">
                  <span title={t('investorsDialogShareHint')}>
                    {row.sharePercent.toFixed(1)}%
                  </span>
                  <span className="font-medium text-base-content">
                    {formatMerits(row.amount)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
