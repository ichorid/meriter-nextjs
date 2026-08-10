'use client';

import { CommentsTabShell } from '@/features/profile';
import { useAuth } from '@/contexts/AuthContext';

export default function ProfileCommentsPage() {
  const { user } = useAuth();
  return <CommentsTabShell userId={user?.id ?? ''} />;
}
