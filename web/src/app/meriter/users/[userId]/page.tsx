import { UserProfilePageClient } from './UserProfilePageClient';

interface UserProfilePageProps {
  params: { userId: string };
}

// Required for static export with dynamic routes
// Return a placeholder to satisfy static export requirements
// Actual routing will be handled client-side
export async function generateStaticParams(): Promise<Array<{ userId: string }>> {
  return [{ userId: '_' }];
}

export default function UserProfilePage({ params }: UserProfilePageProps) {
  const { userId } = params;
  return <UserProfilePageClient userId={userId} />;
}
