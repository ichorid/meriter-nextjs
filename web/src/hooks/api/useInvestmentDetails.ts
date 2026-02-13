import { trpc } from '@/lib/trpc/client';

export function useInvestmentDetails(postId: string | null) {
  return trpc.users.investmentDetails.useQuery(
    { postId: postId ?? '' },
    { enabled: !!postId },
  );
}
