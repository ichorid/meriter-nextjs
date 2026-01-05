import { CommunitySettingsPageClient } from './CommunitySettingsPageClient';

interface CommunitySettingsPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata() {
  return {
    title: 'Community Settings',
  };
}

export default async function CommunitySettingsPage({ params }: CommunitySettingsPageProps) {
  const { id } = await params;
  return <CommunitySettingsPageClient communityId={id} />;
}
