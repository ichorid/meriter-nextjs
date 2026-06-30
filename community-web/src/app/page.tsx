'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc/client';
import { config } from '@/config';

export default function HomePage() {
  const router = useRouter();
  const runtimeConfigQuery = trpc.config.getConfig.useQuery(undefined, {
    retry: false,
  });

  useEffect(() => {
    const target =
      config.defaultCommunityId || runtimeConfigQuery.data?.devCommunityId;
    if (target) {
      router.replace(`/c/${target}/feed`);
      return;
    }
    if (runtimeConfigQuery.isSuccess || runtimeConfigQuery.isError) {
      router.replace('/login');
    }
  }, [
    router,
    runtimeConfigQuery.data?.devCommunityId,
    runtimeConfigQuery.isError,
    runtimeConfigQuery.isSuccess,
  ]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-stitch-muted">
      Загрузка…
    </div>
  );
}
