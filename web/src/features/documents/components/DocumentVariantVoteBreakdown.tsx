'use client';

import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DocumentVariantVoteBreakdownProps {
  votes: Array<{
    userDisplayName: string;
    meritAmount: number;
    comment: string;
  }>;
  expanded: boolean;
  onToggle: () => void;
}

export function DocumentVariantVoteBreakdown({
  votes,
  expanded,
  onToggle,
}: DocumentVariantVoteBreakdownProps) {
  const tCanvas = useTranslations('pages.documents.canvas');

  if (votes.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 border-t border-base-300/40 pt-2">
      <button
        type="button"
        className="flex w-full items-center gap-1.5 text-left text-[11px] font-medium text-base-content/60 hover:text-base-content"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      >
        <ChevronDown
          size={12}
          className={cn('shrink-0 transition-transform', expanded && 'rotate-180')}
        />
        {tCanvas('votesBreakdown', { count: votes.length })}
      </button>
      {expanded ? (
        <ul className="mt-2 space-y-2">
          {votes.map((vote, index) => (
            <li
              key={`${vote.userDisplayName}-${index}`}
              className="rounded-lg bg-base-300/20 px-2.5 py-2 text-[11px]"
            >
              <p className="font-medium text-base-content/85">
                {tCanvas('voteMeritsLine', {
                  name: vote.userDisplayName,
                  amount: Math.abs(vote.meritAmount),
                })}
                {vote.meritAmount < 0 ? ` (${tCanvas('voteDown')})` : ''}
              </p>
              {vote.comment.trim() ? (
                <p className="mt-1 whitespace-pre-wrap text-base-content/65">{vote.comment}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
