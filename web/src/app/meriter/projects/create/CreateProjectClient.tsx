'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CreateProjectForm } from '@/components/organisms/Project/CreateProjectForm';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { useScrollMeriterMainToTop } from '@/hooks/useScrollMeriterMainToTop';

export default function CreateProjectPage() {
  useScrollMeriterMainToTop();
  const router = useRouter();
  const t = useTranslations('projects');

  return (
    <AdaptiveLayout
      stickyHeader={
        <SimpleStickyHeader
          title={t('createProject')}
          showBack={true}
          onBack={() => router.push('/meriter/projects')}
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
