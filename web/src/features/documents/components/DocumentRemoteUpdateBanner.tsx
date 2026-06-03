'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/shadcn/button';
import { cn } from '@/lib/utils';

export type DocumentRemoteUpdateBannerProps = {
  className?: string;
  onKeepMine: () => void;
  onShowServer: () => void;
};

export function DocumentRemoteUpdateBanner({
  className,
  onKeepMine,
  onShowServer,
}: DocumentRemoteUpdateBannerProps) {
  const t = useTranslations('pages.documents.gdocs');

  return (
    <div
      role="status"
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3',
        className,
      )}
    >
      <p className="text-sm leading-snug text-base-content">{t('remoteUpdateBannerMessage')}</p>
      <div className="flex flex-wrap gap-2 sm:justify-end">
        <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={onKeepMine}>
          {t('remoteUpdateKeepMine')}
        </Button>
        <Button type="button" size="sm" className="rounded-lg" onClick={onShowServer}>
          {t('remoteUpdateShowServer')}
        </Button>
      </div>
    </div>
  );
}
