'use client';

import { CommentsTabShell } from '@/features/profile';

export default function UserCommentsClient({ userId }: { userId: string }) {
  return <CommentsTabShell userId={userId} contentClassName="space-y-4 p-4 pb-24" />;
}
