import UserCommentsClient from './UserCommentsClient';

interface PageProps {
  params: Promise<{ userId: string }>;
}

export default async function Page({ params }: PageProps) {
  const { userId } = await params;
  return <UserCommentsClient userId={userId} />;
}
