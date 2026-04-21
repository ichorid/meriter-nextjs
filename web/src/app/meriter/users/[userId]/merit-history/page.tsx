import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import UserMeritHistoryClient from './UserMeritHistoryClient';

function MeritHistoryFallback() {
  return (
    <div className="flex min-h-[40vh] flex-1 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
    </div>
  );
}

export default async function UserMeritHistoryPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  return (
    <Suspense fallback={<MeritHistoryFallback />}>
      <UserMeritHistoryClient userId={userId} />
    </Suspense>
  );
}
