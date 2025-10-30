import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/organisms/EmptyState/EmptyState';
import { UpdateCard } from '@/components/organisms/UpdateCard';
import { sortItems, generateKey } from '../utils';
import type { SortOrder } from '../types';
import type { UpdateEvent } from '@/types/updates';

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
      <div className="flex justify-center items-center h-32">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (updates.length === 0) {
    return (
      <EmptyState
        title={t('empty.updates.title') || 'No Updates'}
        message={
          t('empty.updates.message') ||
          'No updates available.'
        }
        icon="📬"
      />
    );
  }

  return (
    <div className="balance-inpublications-list">
      <div className="balance-inpublications-publications">
        <div className="space-y-3">
          {sortItems(updates, sortOrder).map((update: UpdateEvent, index: number) => {
            const key = generateKey(update?.id, index, 'update');
            return (
              <UpdateCard
                key={key}
                update={update}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

