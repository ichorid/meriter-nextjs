'use client';

import { useTranslations } from 'next-intl';
import { formatMerits } from '@/lib/utils/currency';

export interface EarningsHistoryEntry {
  amount: number;
  date: string;
  reason: 'withdrawal' | 'pool_return' | 'close';
}

export interface InvestmentHistoryListProps {
  entries: EarningsHistoryEntry[];
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function InvestmentHistoryList({ entries }: InvestmentHistoryListProps) {
  const t = useTranslations('profile.investments');

  const reasonLabel = (reason: EarningsHistoryEntry['reason']) => {
    switch (reason) {
      case 'withdrawal':
        return t('reasonWithdrawal');
      case 'pool_return':
        return t('reasonPoolReturn');
      case 'close':
        return t('reasonClose');
      default:
        return reason;
    }
  };

  if (entries.length === 0) {
    return (
      <p className="text-sm text-base-content/50 py-2">{t('noEarningsHistory')}</p>
    );
  }

  return (
    <ul className="space-y-2">
      {entries.map((entry, i) => (
        <li
          key={`${entry.date}-${i}`}
          className="flex items-center justify-between gap-4 py-2 border-b border-base-300 last:border-0"
        >
          <div>
            <p className="text-sm font-medium text-base-content">
              +{formatMerits(entry.amount)}
            </p>
            <p className="text-xs text-base-content/50">
              {reasonLabel(entry.reason)} · {formatDate(entry.date)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
