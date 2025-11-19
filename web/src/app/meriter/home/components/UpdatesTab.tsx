import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/organisms/EmptyState/EmptyState';
import { UpdateCard } from '@/components/organisms/UpdateCard';
import { sortItems, generateKey } from '../utils';
import type { SortOrder } from '../types';
import type { UpdateEvent } from '@/types/updates';
// Gluestack UI components
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { Spinner } from '@/components/ui/spinner';

interface UpdatesTabProps {
  updates: UpdateEvent[];
  isLoading: boolean;
  sortOrder: SortOrder;
}

export function UpdatesTab({
  updates,
  isLoading,
  sortOrder,
}: UpdatesTabProps) {
  const t = useTranslations('home');

  if (isLoading) {
    return (
      <Box flex={1} alignItems="center" justifyContent="center" height={128}>
        <Spinner size="large" />
      </Box>
    );
  }

  if (updates.length === 0) {
    return (
      <EmptyState
        title={t('empty.updates.title') || 'No Updates'}
      />
    );
  }

  return (
    <VStack space="md">
      {sortItems(updates, sortOrder).map((update: UpdateEvent, index: number) => {
        const key = generateKey(update?.id, index, 'update');
        return (
          <UpdateCard
            key={key}
            update={update}
          />
        );
      })}
    </VStack>
  );
}

