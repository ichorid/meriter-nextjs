import { trpc } from '@/lib/trpc/client';
import type { SubmitTappalkaChoiceInput } from '../types';

/**
 * Hook to submit user's choice in tappalka comparison
 * 
 * Automatically invalidates progress query on success
 */
export function useTappalkaChoice() {
  const utils = trpc.useUtils();

  return trpc.tappalka.submitChoice.useMutation({
    onSuccess: () => {
      // Invalidate progress to update UI
      utils.tappalka.getProgress.invalidate();
    },
  });
}

