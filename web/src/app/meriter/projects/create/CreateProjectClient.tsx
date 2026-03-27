'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { CreateProjectForm } from '@/components/organisms/Project/CreateProjectForm';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { useScrollMeriterMainToTop } from '@/hooks/useScrollMeriterMainToTop';
import { sanitizeMeriterInternalPath } from '@/lib/utils/safe-meriter-path';

export default function CreateProjectPage() {
  useScrollMeriterMainToTop();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('projects');

  const backPath = useMemo(() => {
    const raw = searchParams?.get('returnTo');
    return sanitizeMeriterInternalPath(raw) ?? '/meriter/projects';
  }, [searchParams]);

  return (
    <AdaptiveLayout
      stickyHeader={
        <SimpleStickyHeader
          title={t('createProject')}
          showBack={true}
          onBack={() => router.push(backPath)}
          asStickyHeader={true}
        />
      }
    >
      <div className="space-y-6 p-4">
        <CreateProjectForm />
      </div>
    </AdaptiveLayout>
  );
}
