'use client';

import { useTranslations } from 'next-intl';
import { FutureVisionFeed } from '@/components/organisms/FutureVision/FutureVisionFeed';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout/AdaptiveLayout';

export default function FutureVisionsPageClient() {
  const t = useTranslations('common');

  return (
    <AdaptiveLayout>
      <div className="flex flex-col gap-4 p-4">
        <h1 className="text-2xl font-semibold">
          {t('futureVisions', { defaultValue: 'Future Visions' })}
        </h1>
        <FutureVisionFeed />
      </div>
    </AdaptiveLayout>
  );
}
