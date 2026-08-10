'use client';

import { PublicationsTabShell } from '@/features/profile';
import { useAuth } from '@/contexts/AuthContext';

export default function ProfilePublicationsPage() {
  const { user } = useAuth();
  return <PublicationsTabShell userId={user?.id ?? ''} />;
}
