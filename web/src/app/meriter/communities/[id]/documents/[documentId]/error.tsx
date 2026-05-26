'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/shadcn/button';

export default function CommunityDocumentDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('pages.documents');

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-start gap-3 p-4">
      <p className="text-sm text-error">{t('detailError')}</p>
      {error.message ? (
        <p className="text-xs text-base-content/60">{error.message}</p>
      ) : null}
      <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={reset}>
        {t('retryLoad')}
      </Button>
    </div>
  );
}
