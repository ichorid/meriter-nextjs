import { UserProfilePageClient } from './UserProfilePageClient';

interface UserProfilePageProps {
  params: Promise<{ userId: string }>;
}

export default async function UserProfilePage({ params }: UserProfilePageProps) {
  const { userId } = await params;
  return <UserProfilePageClient userId={userId} />;
}
