import UserMeritTransfersClient from './UserMeritTransfersClient';

interface PageProps {
  params: Promise<{ userId: string }>;
}

export default async function Page({ params }: PageProps) {
  const { userId } = await params;
  return <UserMeritTransfersClient userId={userId} />;
}
