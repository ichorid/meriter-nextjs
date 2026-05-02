'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/shadcn/button';
import { cn } from '@/lib/utils';
import { pilotDreamHref } from '@/lib/constants/pilot-routes';

export type PilotDreamFeedOpenTasksProps = {
  projectId: string;
  total: number;
  tickets: { id: string; title?: string }[];
};

export function PilotDreamFeedOpenTasks({ projectId, total, tickets }: PilotDreamFeedOpenTasksProps) {
  const t = useTranslations('multiObraz');
  const tProjects = useTranslations('projects');
  const [open, setOpen] = useState(false);

  const taskHref = (ticketId: string) =>
    `${pilotDreamHref(projectId)}?tab=tickets&highlight=${encodeURIComponent(ticketId)}`;

  return (
    <div className="mt-3 rounded-xl border border-[#334155] bg-[#0f172a]/60">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium text-[#e2e8f0] hover:bg-white/[0.04]"
      >
        <span>{t('feedOpenTasksHeading', { count: total })}</span>
        <ChevronDown
          className={cn('size-4 shrink-0 text-[#94a3b8] transition-transform duration-200', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      {open ? (
        <ul className="space-y-2 border-t border-[#334155]/80 px-3 pb-3 pt-2">
          {tickets.map((ticket) => (
            <li
              key={ticket.id}
              className="rounded-lg border border-[#334155] bg-[#0f172a] p-3"
            >
              <p className="line-clamp-3 text-sm font-medium text-white">
                {ticket.title?.trim() || t('feedOpenTaskUntitled')}
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-2 h-8 w-full rounded-lg border border-[#334155] bg-[#1e293b] text-xs text-[#e2e8f0] hover:bg-[#334155]/40 sm:w-auto"
                asChild
              >
                <Link href={taskHref(ticket.id)}>{tProjects('takeTask')}</Link>
              </Button>
            </li>
          ))}
          {total > tickets.length ? (
            <li className="text-center text-xs text-[#64748b]">
              <Link href={pilotDreamHref(projectId)} className="text-[#94a3b8] underline-offset-2 hover:text-[#cbd5e1] hover:underline">
                {t('feedOpenTasksMore', { count: total - tickets.length })}
              </Link>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
