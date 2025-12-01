import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invitesApi } from '@/lib/api/wrappers/invites-api';
import { customInstance } from '@/lib/api/wrappers/mutator';
import type { Invite } from '@/types/api-v1';

export function useInvites() {
  return useQuery({
    queryKey: ['invites'],
        queryFn: () => invitesApi.getList(),
  });
}

export function useInviteByCode(code: string) {
  return useQuery({
    queryKey: ['invites', code],
        queryFn: () => invitesApi.getById(code),
    enabled: !!code,
  });
}

export function useCreateInvite() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: {
      targetUserId: string;
      type: 'superadmin-to-lead' | 'lead-to-participant';
      communityId: string;
      teamId?: string;
      expiresAt?: string;
    }) => invitesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invites'] });
    },
  });
}

export function useInvite() {
  const queryClient = useQueryClient();
  
  return useMutation({
        mutationFn: (code: string) => invitesApi.accept(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invites'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'me'] });
    },
  });
}

export function useDeleteInvite() {
  const queryClient = useQueryClient();
  
  return useMutation({
        mutationFn: (id: string) => invitesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invites'] });
    },
  });
}








