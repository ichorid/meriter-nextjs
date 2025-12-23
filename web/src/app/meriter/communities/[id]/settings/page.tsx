import { CommunitySettingsPageClient } from './CommunitySettingsPageClient';

interface CommunitySettingsPageProps {
  params: Promise<{ id: string }>;
}

// Required for static export with dynamic routes
export async function generateStaticParams() {
  // Return empty array - dynamic routes will be handled client-side
  return [];
}

export default async function CommunitySettingsPage({ params }: CommunitySettingsPageProps) {
  const { id } = await params;
  return <CommunitySettingsPageClient communityId={id} />;
}
