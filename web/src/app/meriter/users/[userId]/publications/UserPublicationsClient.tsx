'use client';

import { PublicationsTabShell } from '@/features/profile';

export default function UserPublicationsClient({ userId }: { userId: string }) {
  return <PublicationsTabShell userId={userId} contentClassName="space-y-4 p-4" />;
}
