import { useTranslations } from 'next-intl';
import { PublicationCardComponent as PublicationCard } from '@/components/organisms/Publication';
import { EmptyState } from '@/components/organisms/EmptyState/EmptyState';
import { sortItems, generateKey } from '../utils';
import type { SortOrder } from '../types';

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
      <div className="flex justify-center items-center h-32">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
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
        icon="📝"
      />
    );
  }

  const filteredPublications = publications.filter(
    (p) => p && (p.content || p.type === 'poll' || p.title)
  );

  return (
    <div className="space-y-4">
      {sortItems(filteredPublications, sortOrder).map((p, index) => {
        const key = generateKey(p?.id, index, 'pub');
        return (
          <PublicationCard
            key={key}
            publication={p}
            wallets={wallets}
            showCommunityAvatar={true}
            className="w-full"
          />
        );
      })}
    </div>
  );
}

