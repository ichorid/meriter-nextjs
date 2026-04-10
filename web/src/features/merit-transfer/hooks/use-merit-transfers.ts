import { trpc } from '@/lib/trpc/client';

export function useMeritTransfersByCommunity(
  communityId: string | undefined,
  opts?: { page?: number; limit?: number },
) {
  return trpc.meritTransfer.getByCommunity.useQuery(
    {
      communityId: communityId!,
      page: opts?.page,
      limit: opts?.limit,
    },
    {
      enabled: !!communityId,
    },
  );
}

export function useMeritTransfersByUser(
  userId: string | undefined,
  direction: 'incoming' | 'outgoing',
  opts?: { page?: number; limit?: number },
) {
  return trpc.meritTransfer.getByUser.useQuery(
    {
      userId: userId!,
      transferDirection: direction,
      page: opts?.page,
      limit: opts?.limit,
    },
    {
      enabled: !!userId,
    },
  );
}
