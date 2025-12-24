import { CommunitySettingsPageClient } from './CommunitySettingsPageClient';

interface CommunitySettingsPageProps {
  params: { id: string };
}

// Required for static export with dynamic routes
export async function generateStaticParams(): Promise<Array<{ id: string }>> {
  // Return empty array - dynamic routes will be handled client-side
  return [];
}

export default function CommunitySettingsPage({ params }: CommunitySettingsPageProps) {
  const { id } = params;
  return <CommunitySettingsPageClient communityId={id} />;
}
