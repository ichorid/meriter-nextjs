'use client';

import { useLocale } from 'next-intl';
import { htmlOrTextToPlain } from '@/lib/utils/plain-text-excerpt';

export type PilotThreadCommentRowModel = {
  id: string;
  content?: string | null;
  authorId?: string;
  createdAt?: string;
  meta?: { author?: { name?: string; username?: string } | null };
};

function formatCommentWhen(iso: string | undefined, locale: string): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return null;
  }
}

function authorLabel(comment: PilotThreadCommentRowModel): string {
  const fromMeta =
    comment.meta?.author?.name?.trim() || comment.meta?.author?.username?.trim();
  if (fromMeta) return fromMeta;
  if (comment.authorId) return comment.authorId.slice(0, 8);
  return '—';
}

export function PilotThreadCommentRow({ comment }: { comment: PilotThreadCommentRowModel }) {
  const locale = useLocale();
  const when = formatCommentWhen(comment.createdAt, locale);
  const body = htmlOrTextToPlain(comment.content ?? '');

  return (
    <li className="rounded-md bg-[#0f172a]/80 px-3 py-2 text-sm text-[#cbd5e1]">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-xs text-[#94a3b8]">
        <span className="font-medium text-[#e2e8f0]">{authorLabel(comment)}</span>
        {when ? (
          <time className="tabular-nums text-[#94a3b8]" dateTime={comment.createdAt}>
            {when}
          </time>
        ) : null}
      </div>
      {body ? <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{body}</p> : null}
    </li>
  );
}
