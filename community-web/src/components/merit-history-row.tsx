'use client';

import {
  formatMeritHistoryLine,
  meritHistoryMessageLink,
  resolveMeritHistoryDisplayAmount,
  type MeritHistoryEnrichment,
} from '@/lib/merit-history-line';
import { openTelegramMessage } from '@/lib/telegram-message-link';

export type MeritHistoryRowData = {
  id: string;
  type: string;
  amount: number;
  description?: string | null;
  referenceType?: string | null;
  createdAt: string;
  ledgerMultiplier?: number;
  meritHistoryEnrichment?: MeritHistoryEnrichment | null;
};

function formatMeritAmount(amount: number): string {
  const sign = amount > 0 ? '+' : '';
  return `${sign}${amount}`;
}

export function MeritHistoryRow({ row }: { row: MeritHistoryRowData }) {
  const { signed, tone } = resolveMeritHistoryDisplayAmount({
    type: row.type,
    amount: row.amount,
    description: row.description,
    referenceType: row.referenceType,
    ledgerMultiplier: row.ledgerMultiplier,
    meritHistoryEnrichment: row.meritHistoryEnrichment,
  });
  const line = formatMeritHistoryLine(row);
  const msgLink = meritHistoryMessageLink(row.meritHistoryEnrichment);
  const pubTitle = row.meritHistoryEnrichment?.publicationTitle?.trim();

  return (
    <li className="rounded-lg border border-stitch-border bg-stitch-surface px-3 py-2 text-sm">
      <div className="flex justify-between gap-2">
        <span className="min-w-0 leading-snug">{line}</span>
        <span
          className={
            tone === 'positive'
              ? 'text-green-400 shrink-0 tabular-nums'
              : 'text-red-400 shrink-0 tabular-nums'
          }
        >
          {formatMeritAmount(signed)}
        </span>
      </div>
      {pubTitle && !msgLink ? (
        <p className="mt-0.5 text-xs text-stitch-muted truncate">«{pubTitle}»</p>
      ) : null}
      {msgLink ? (
        <button
          type="button"
          onClick={() => openTelegramMessage(msgLink.chatId, msgLink.messageId)}
          className="mt-1 text-xs text-primary hover:underline text-left"
        >
          {msgLink.label}
        </button>
      ) : null}
      <p className="text-xs text-stitch-muted mt-0.5">
        {new Date(row.createdAt).toLocaleString('ru-RU')}
      </p>
    </li>
  );
}
