import React from 'react';
import { CommentsColumn } from '@/components/organisms/CommentsColumn';
import { useSearchParams } from 'next/navigation';

export interface CommentsColumnHelperProps {
  publicationSlug: string;
  communityId: string;
  balance: any;
  wallets: any[];
  myId?: string;
  highlightTransactionId?: string;
  activeCommentHook: [string | null, React.Dispatch<React.SetStateAction<string | null>>];
  activeWithdrawPost: string | null;
  setActiveWithdrawPost: (id: string | null) => void;
}

export function createCommentsColumnProps(
  publicationSlug: string,
  communityId: string,
  searchParams: ReturnType<typeof useSearchParams>,
  props: Omit<CommentsColumnHelperProps, 'publicationSlug' | 'communityId'>
): CommentsColumnHelperProps & { showBackButton: boolean; onBack: () => void } {
  return {
    publicationSlug,
    communityId,
    ...props,
    showBackButton: true,
    onBack: () => {
      // Remove post query param
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.delete('post');
      window.history.replaceState({}, '', `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`);
    },
  };
}

