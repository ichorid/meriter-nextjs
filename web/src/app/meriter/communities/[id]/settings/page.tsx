import { CommunitySettingsPageClient } from './CommunitySettingsPageClient';

interface CommunitySettingsPageProps {
  params: Promise<{ id: string }>;
}

export default async function CommunitySettingsPage({ params }: CommunitySettingsPageProps) {
  const { id } = await params;
  return <CommunitySettingsPageClient communityId={id} />;
}
