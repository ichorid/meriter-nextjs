import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/organisms/EmptyState/EmptyState';
import { UpdateCard } from '@/components/organisms/UpdateCard';
import { sortItems, generateKey } from '../utils';
import type { SortOrder } from '../types';
import type { UpdateEvent } from '@/types/updates';
import { Loader2 } from 'lucide-react';

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
      <div className="flex flex-1 items-center justify-center h-32">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      </div>
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
    <div className="space-y-4">
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
  );
}

