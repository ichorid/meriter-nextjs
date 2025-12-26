import { CommunitySettingsPageClient } from './CommunitySettingsPageClient';

interface CommunitySettingsPageProps {
  params: { id: string };
}

export default function CommunitySettingsPage({ params }: CommunitySettingsPageProps) {
  const { id } = params;
  return <CommunitySettingsPageClient communityId={id} />;
}
