'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { CreateProjectForm } from '@/components/organisms/Project/CreateProjectForm';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { Button } from '@/components/ui/shadcn/button';
import { ChevronLeft } from 'lucide-react';

export default function CreateProjectPage() {
  const t = useTranslations('projects');

  return (
    <AdaptiveLayout>
      <div className="flex flex-col gap-4 p-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/meriter/projects">
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back to projects
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">{t('createProject')}</h1>
        <CreateProjectForm />
      </div>
    </AdaptiveLayout>
  );
}
