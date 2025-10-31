import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook to handle authentication checks and redirects
 */
export function useHomeAuth() {
  const router = useRouter();
  const { user, isLoading: userLoading, isAuthenticated } = useAuth();
  const authCheckDone = useRef(false);

  useEffect(() => {
    if (!authCheckDone.current && !userLoading && !isAuthenticated) {
      authCheckDone.current = true;
      router.push(
        '/meriter/login?returnTo=' +
          encodeURIComponent(window.location.pathname)
      );
    }
  }, [isAuthenticated, userLoading, router]);

  return {
    user,
    userLoading,
    isAuthenticated,
  };
}

