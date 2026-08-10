'use client';

import { useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { ProfileTopBar } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { useAuth } from '@/contexts/AuthContext';
import type { Wallet } from '@/types/api-v1';

export interface ProfileTabPageFrameProps {
  title: string;
  children: ReactNode;
  contentClassName?: string;
  wallets?: Wallet[];
  myId?: string;
  withFeedInteractions?: boolean;
}

export function ProfileTabPageFrame({
  title,
  children,
  contentClassName = 'space-y-4',
  wallets = [],
  myId,
  withFeedInteractions = false,
}: ProfileTabPageFrameProps) {
  const { isLoading: userLoading, isAuthenticated } = useAuth();
  const [activeWithdrawPost, setActiveWithdrawPost] = useState<string | null>(null);
  const activeCommentHook = useState<string | null>(null);

  const pageHeader = (
    <ProfileTopBar asStickyHeader title={title} showBack />
  );

  if (userLoading || !isAuthenticated) {
    return (
      <AdaptiveLayout className="feed" stickyHeader={pageHeader}>
        <div className="flex h-64 flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
        </div>
      </AdaptiveLayout>
    );
  }

  return (
    <AdaptiveLayout
      className="feed"
      stickyHeader={pageHeader}
      wallets={wallets}
      myId={myId}
      {...(withFeedInteractions
        ? {
            activeCommentHook,
            activeWithdrawPost,
            setActiveWithdrawPost,
          }
        : {})}
    >
      <div className={contentClassName}>{children}</div>
    </AdaptiveLayout>
  );
}
