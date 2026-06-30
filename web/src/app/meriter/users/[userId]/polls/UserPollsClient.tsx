'use client';

import { PollsTabShell } from '@/features/profile';

export default function UserPollsClient({ userId }: { userId: string }) {
  return <PollsTabShell userId={userId} contentClassName="space-y-4 p-4" />;
}
