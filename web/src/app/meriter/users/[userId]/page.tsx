import { UserProfilePageClient } from './UserProfilePageClient';
import config from '@/config';

interface UserProfilePageProps {
  params: Promise<{ userId: string }>;
}

export async function generateMetadata({ params }: UserProfilePageProps) {
  try {
    const { userId } = await params;
    // Fetch user data from API for metadata
    const apiUrl = config.api.baseUrl || 'http://localhost:8001';
    const response = await fetch(`${apiUrl}/trpc/users.getById?input=${encodeURIComponent(JSON.stringify({ json: { id: userId } }))}`, {
      cache: 'no-store',
    });

    if (response.ok) {
      const data = await response.json();
      const userName = data?.result?.data?.json?.displayName || data?.result?.data?.json?.username;
      if (userName) {
        return {
          title: userName,
        };
      }
    }
  } catch (error) {
    console.error('Failed to fetch user for metadata:', error);
  }

  // Fallback to generic title
  return {
    title: 'User Profile',
  };
}

export default async function UserProfilePage({ params }: UserProfilePageProps) {
  const { userId } = await params;
  return <UserProfilePageClient userId={userId} />;
}
