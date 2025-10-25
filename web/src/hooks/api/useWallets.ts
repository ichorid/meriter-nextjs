import { useQuery } from '@tanstack/react-query';
import { usersApiV1 } from '@/lib/api/v1';
import { queryKeys } from '@/lib/constants/queryKeys';
import { useAuth } from '@/contexts/AuthContext';

export const useWallets = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: queryKeys.wallet.wallets(user?.tgUserId),
    queryFn: () => usersApiV1.getUserWallets(user?.tgUserId || ''),
    enabled: !!user?.tgUserId,
  });
};

export const useTransactions = (params: Record<string, any> = {}) => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: queryKeys.wallet.transactionsList({ userId: user?.tgUserId, ...params }),
    queryFn: () => usersApiV1.getUserTransactions(user?.tgUserId || '', params),
    enabled: !!user?.tgUserId,
  });
};
