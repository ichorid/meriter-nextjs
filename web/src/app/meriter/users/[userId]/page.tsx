import { UserProfilePageClient } from './UserProfilePageClient';

interface UserProfilePageProps {
  params: Promise<{ userId: string }>;
}

// Required for static export with dynamic routes
export async function generateStaticParams() {
  // Return empty array - dynamic routes will be handled client-side
  return [];
}

export default async function UserProfilePage({ params }: UserProfilePageProps) {
  const { userId } = await params;
  return <UserProfilePageClient userId={userId} />;
}
