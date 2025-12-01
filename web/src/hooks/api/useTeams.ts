import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamsApi } from '@/lib/api/wrappers/teams-api';
import { customInstance } from '@/lib/api/wrappers/mutator';
import { queryKeys } from '@/lib/constants/queryKeys';
import type { Team } from '@/types/api-v1';

export function useTeams() {
  return useQuery({
    queryKey: ['teams'],
        queryFn: () => teamsApi.getList(),
  });
}

export function useTeam(id: string) {
  return useQuery({
    queryKey: ['teams', id],
        queryFn: () => teamsApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateTeam() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: {
      name: string;
      communityId: string;
      school?: string;
      metadata?: Record<string, any>;
    }) => teamsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });
}

export function useUpdateTeam() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: {
      name?: string;
      school?: string;
      metadata?: Record<string, any>;
    }}) => teamsApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['teams', variables.id] });
    },
  });
}

export function useDeleteTeam() {
  const queryClient = useQueryClient();
  
  return useMutation({
        mutationFn: (id: string) => teamsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });
}

export function useTeamParticipants(id: string) {
  return useQuery({
    queryKey: ['teams', id, 'participants'],
        queryFn: () => customInstance({ url: `/api/v1/teams/${id}/participants`, method: 'GET' }),
    enabled: !!id,
  });
}

export function useRemoveParticipant() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) =>
      customInstance({ url: `/api/v1/teams/${teamId}/participants/${userId}`, method: 'DELETE' }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['teams', variables.teamId, 'participants'] });
      queryClient.invalidateQueries({ queryKey: ['teams', variables.teamId] });
    },
  });
}








