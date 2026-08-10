'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { trpc } from '@/lib/trpc/client';

/**
 * After magic-link redeem the API redirects with ?sessionRefresh=1 so linkedProviders
 * and other auth fields are refetched (useMe keeps a 5-minute stale cache).
 */
export function AuthSessionRefresh() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const utils = trpc.useUtils();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    if (searchParams?.get('sessionRefresh') !== '1') return;

    handledRef.current = true;

    void (async () => {
      await utils.users.getMe.invalidate();
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.delete('sessionRefresh');
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    })();
  }, [searchParams, pathname, router, utils]);

  return null;
}
