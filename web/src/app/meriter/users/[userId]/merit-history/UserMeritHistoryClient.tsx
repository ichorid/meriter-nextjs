'use client';

import { UserMeritHistoryShell } from '@/features/profile';

export default function UserMeritHistoryClient({ userId }: { userId: string }) {
  return <UserMeritHistoryShell userId={userId} />;
}
