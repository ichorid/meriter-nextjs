import { UserProfilePageClient } from './UserProfilePageClient';

export const dynamic = 'force-static';
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

export default async function UserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  return <UserProfilePageClient userId={userId} />;
}
