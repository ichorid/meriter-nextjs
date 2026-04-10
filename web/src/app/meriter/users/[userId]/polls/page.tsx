import UserPollsClient from './UserPollsClient';

interface PageProps {
  params: Promise<{ userId: string }>;
}

export default async function Page({ params }: PageProps) {
  const { userId } = await params;
  return <UserPollsClient userId={userId} />;
}
