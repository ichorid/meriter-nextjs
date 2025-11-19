import { useTranslations } from 'next-intl';
import { PublicationCardComponent as PublicationCard } from '@/components/organisms/Publication';
import { EmptyState } from '@/components/organisms/EmptyState/EmptyState';
import { sortItems, generateKey } from '../utils';
import type { SortOrder } from '../types';
// Gluestack UI components
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { Spinner } from '@/components/ui/spinner';

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
      <Box flex={1} alignItems="center" justifyContent="center" height={128}>
        <Spinner size="large" />
      </Box>
    );
  }

  if (polls.length === 0) {
    return (
      <EmptyState
        title={t('empty.polls.title') || 'No Polls'}
        message={
          t('empty.polls.message') || "You haven't created any polls yet."
        }
      />
    );
  }

  return (
    <VStack space="md">
      {sortItems(polls, sortOrder).map((poll: any, index: number) => {
        const key = generateKey(poll?.id, index, 'poll');
        return (
          <PublicationCard
            key={key}
            publication={poll}
            wallets={wallets}
            showCommunityAvatar={true}
          />
        );
      })}
    </VStack>
  );
}

