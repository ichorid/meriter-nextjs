import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { CommunitySettingsPageClient } from './CommunitySettingsPageClient';

interface CommunitySettingsPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata() {
  return {
    title: 'Community Settings',
  };
}

function SettingsPageSuspenseFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-brand-primary" aria-hidden />
    </div>
  );
}

export default async function CommunitySettingsPage({ params }: CommunitySettingsPageProps) {
  const { id } = await params;
  return (
    <Suspense fallback={<SettingsPageSuspenseFallback />}>
      <CommunitySettingsPageClient communityId={id} />
    </Suspense>
  );
}
