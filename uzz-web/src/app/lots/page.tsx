'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LotsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/?tab=lots');
  }, [router]);
  return null;
}
