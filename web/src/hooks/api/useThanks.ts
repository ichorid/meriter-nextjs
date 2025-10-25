// Thanks React Query hooks
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { thanksApi } from '@/lib/api';
import type { CreateThankRequest } from '@/types/api-v1';

// Thank publication creator
export function useThankPublication() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ publicationId, data }: { publicationId: string; data: CreateThankRequest }) => 
      thanksApi.thankPublication(publicationId, data),
    onSuccess: (result) => {
      // Invalidate publications to update thank counts
      queryClient.invalidateQueries({ queryKey: ['publications'] });
      
      // Invalidate wallet queries to update balance
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      
      // If a comment was created, invalidate comments
      if (result.comment) {
        queryClient.invalidateQueries({ queryKey: ['comments'] });
      }
    },
    onError: (error) => {
      console.error('Thank publication error:', error);
    },
  });
}

// Thank comment creator
export function useThankComment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ commentId, data }: { commentId: string; data: CreateThankRequest }) => 
      thanksApi.thankComment(commentId, data),
    onSuccess: (result) => {
      // Invalidate comments to update thank counts
      queryClient.invalidateQueries({ queryKey: ['comments'] });
      
      // Invalidate wallet queries to update balance
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      
      // If a comment was created, invalidate comments
      if (result.comment) {
        queryClient.invalidateQueries({ queryKey: ['comments'] });
      }
    },
    onError: (error) => {
      console.error('Thank comment error:', error);
    },
  });
}

// Remove thank from publication
export function useRemovePublicationThank() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (publicationId: string) => thanksApi.removePublicationThank(publicationId),
    onSuccess: () => {
      // Invalidate publications to update thank counts
      queryClient.invalidateQueries({ queryKey: ['publications'] });
      
      // Invalidate wallet queries to update balance
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
    },
    onError: (error) => {
      console.error('Remove publication thank error:', error);
    },
  });
}

// Remove thank from comment
export function useRemoveCommentThank() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (commentId: string) => thanksApi.removeCommentThank(commentId),
    onSuccess: () => {
      // Invalidate comments to update thank counts
      queryClient.invalidateQueries({ queryKey: ['comments'] });
      
      // Invalidate wallet queries to update balance
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
    },
    onError: (error) => {
      console.error('Remove comment thank error:', error);
    },
  });
}
