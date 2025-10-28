import { useQuery } from '@tanstack/react-query';
import { usersApiV1 } from '@/lib/api/v1';
import { queryKeys } from '@/lib/constants/queryKeys';
import { useAuth } from '@/contexts/AuthContext';

export const useWallets = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: queryKeys.wallet.wallets(),
    queryFn: () => usersApiV1.getUserWallets(user?.id || ''),
    enabled: !!user?.id,
  });
};

export const useTransactions = (params: Record<string, any> = {}) => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: queryKeys.wallet.transactionsList({ userId: user?.id, ...params }),
    queryFn: () => usersApiV1.getUserTransactions(user?.id || '', params),
    enabled: !!user?.id,
  });
};
