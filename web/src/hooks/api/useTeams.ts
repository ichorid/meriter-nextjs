import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamsApiV1 } from '@/lib/api/v1';
import { queryKeys } from '@/lib/constants/queryKeys';
import type { Team } from '@/types/api-v1';

export function useTeams() {
  return useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApiV1.getTeams(),
  });
}

export function useTeam(id: string) {
  return useQuery({
    queryKey: ['teams', id],
    queryFn: () => teamsApiV1.getTeam(id),
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
    }) => teamsApiV1.createTeam(data),
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
    }}) => teamsApiV1.updateTeam(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['teams', variables.id] });
    },
  });
}

export function useDeleteTeam() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => teamsApiV1.deleteTeam(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });
}

export function useTeamParticipants(id: string) {
  return useQuery({
    queryKey: ['teams', id, 'participants'],
    queryFn: () => teamsApiV1.getTeamParticipants(id),
    enabled: !!id,
  });
}

export function useRemoveParticipant() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) =>
      teamsApiV1.removeParticipant(teamId, userId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['teams', variables.teamId, 'participants'] });
      queryClient.invalidateQueries({ queryKey: ['teams', variables.teamId] });
    },
  });
}





