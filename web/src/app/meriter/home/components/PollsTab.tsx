import { useTranslations } from 'next-intl';
import { PublicationCardComponent as PublicationCard } from '@/components/organisms/Publication';
import { EmptyState } from '@/components/organisms/EmptyState/EmptyState';
import { sortItems, generateKey } from '../utils';
import type { SortOrder } from '../types';

interface PollsTabProps {
  polls: any[];
  isLoading: boolean;
  wallets: any[];
  sortOrder: SortOrder;
}

export function PollsTab({
  polls,
  isLoading,
  wallets,
  sortOrder,
}: PollsTabProps) {
  const t = useTranslations('home');

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-32">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (polls.length === 0) {
    return (
      <EmptyState
        title={t('empty.polls.title') || 'No Polls'}
        message={
          t('empty.polls.message') || "You haven't created any polls yet."
        }
        icon="📊"
      />
    );
  }

  return (
    <div className="space-y-4">
      {sortItems(polls, sortOrder).map((poll: any, index: number) => {
        const key = generateKey(poll?.id, index, 'poll');
        return (
          <PublicationCard
            key={key}
            publication={poll}
            wallets={wallets}
            showCommunityAvatar={true}
            className="w-full"
          />
        );
      })}
    </div>
  );
}

