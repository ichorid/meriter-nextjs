'use client';

import { PollsTabShell } from '@/features/profile';
import { useAuth } from '@/contexts/AuthContext';

export default function ProfilePollsPage() {
  const { user } = useAuth();
  return <PollsTabShell userId={user?.id ?? ''} />;
}
