import { CommunityPageClient } from './CommunityPageClient';
import config from '@/config';

interface CommunityPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: CommunityPageProps) {
  try {
    const { id } = await params;
    // Fetch community data from API for metadata
    // Use cookies from request headers for authentication
    const { headers: requestHeaders } = await import('next/headers');
    const headersList = await requestHeaders();
    const cookie = headersList.get('cookie');

    const apiUrl = config.api.baseUrl || 'http://localhost:8001';
    const response = await fetch(`${apiUrl}/trpc/communities.getById?input=${encodeURIComponent(JSON.stringify({ json: { id } }))}`, {
      cache: 'no-store',
      headers: cookie ? { cookie } : {},
    });

    if (response.ok) {
      const data = await response.json();
      const communityName = data?.result?.data?.json?.name;
      if (communityName) {
        return {
          title: communityName,
        };
      }
    }
  } catch (error) {
    console.error('Failed to fetch community for metadata:', error);
  }

  // Fallback to generic title
  return {
    title: 'Community',
  };
}

export default async function CommunityPage({ params }: CommunityPageProps) {
  const { id } = await params;
  // 404 handling is done in CommunityPageClient component
  // since we need to check the API response to determine if community exists
  return <CommunityPageClient communityId={id} />;
}
