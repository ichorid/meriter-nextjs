import { useTranslations } from 'next-intl';
import { PublicationCardComponent as PublicationCard } from '@/components/organisms/Publication';
import { EmptyState } from '@/components/organisms/EmptyState/EmptyState';
import { sortItems, generateKey } from '../utils';
import type { SortOrder } from '../types';
// Gluestack UI components
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { Spinner } from '@/components/ui/spinner';

interface PublicationsTabProps {
  publications: any[];
  isLoading: boolean;
  wallets: any[];
  sortOrder: SortOrder;
}

export function PublicationsTab({
  publications,
  isLoading,
  wallets,
  sortOrder,
}: PublicationsTabProps) {
  const t = useTranslations('home');

  if (isLoading) {
    return (
      <Box flex={1} alignItems="center" justifyContent="center" height={128}>
        <Spinner size="large" />
      </Box>
    );
  }

  if (publications.length === 0) {
    return (
      <EmptyState
        title={t('empty.publications.title') || 'No Publications'}
        message={
          t('empty.publications.message') ||
          "You haven't created any publications yet."
        }
      />
    );
  }

  const filteredPublications = publications.filter(
    (p) => p && (p.content || p.type === 'poll' || p.title)
  );

  return (
    <VStack space="md">
      {sortItems(filteredPublications, sortOrder).map((p, index) => {
        const key = generateKey(p?.id, index, 'pub');
        return (
          <PublicationCard
            key={key}
            publication={p}
            wallets={wallets}
            showCommunityAvatar={true}
          />
        );
      })}
    </VStack>
  );
}

