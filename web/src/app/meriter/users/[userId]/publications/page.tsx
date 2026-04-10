import UserPublicationsClient from './UserPublicationsClient';

interface PageProps {
  params: Promise<{ userId: string }>;
}

export default async function Page({ params }: PageProps) {
  const { userId } = await params;
  return <UserPublicationsClient userId={userId} />;
}
