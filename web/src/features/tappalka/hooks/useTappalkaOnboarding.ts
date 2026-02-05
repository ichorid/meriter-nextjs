import { trpc } from '@/lib/trpc/client';
import type { MarkTappalkaOnboardingSeenInput } from '../types';

/**
 * Hook to mark tappalka onboarding as seen for a community
 * 
 * Automatically invalidates progress query on success to update onboardingSeen flag
 */
export function useTappalkaOnboarding() {
  const utils = trpc.useUtils();

  return trpc.tappalka.markOnboardingSeen.useMutation({
    onSuccess: () => {
      // Invalidate progress to update onboardingSeen flag in UI
      utils.tappalka.getProgress.invalidate();
    },
  });
}

