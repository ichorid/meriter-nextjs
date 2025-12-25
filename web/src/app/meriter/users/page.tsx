'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Dummy static route to work around Next.js 15.5.7 bug
 * where isolated dynamic routes don't properly detect generateStaticParams()
 * This route redirects to profile page
 */
export default function UsersIndex() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to profile page
    router.replace('/meriter/profile');
  }, [router]);

  return null;
}


