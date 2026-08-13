'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Skeleton } from '@/components/ui';

export default function DeedsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/?tab=deeds');
  }, [router]);
  return (
    <AppShell>
      <div className="space-y-3" aria-busy>
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-28 w-full" />
      </div>
    </AppShell>
  );
}
