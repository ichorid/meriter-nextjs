'use client';

import { useId, useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { cn } from '@/lib/utils';

type HintIconProps = {
  text: string;
  className?: string;
};

export function HintIcon({ text, className }: HintIconProps) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  return (
    <span className={cn('group/hint relative inline-flex align-middle', className)}>
      <button
        type="button"
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-stitch-muted transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        aria-label="Подсказка"
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        onClick={() => setOpen((value) => !value)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setOpen(false);
          }
        }}
      >
        <CircleHelp className="h-4 w-4" aria-hidden />
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className={cn(
          'pointer-events-none absolute left-1/2 top-[calc(100%+0.35rem)] z-30 w-[min(17rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-stitch-border bg-stitch-elevated px-3 py-2 text-left text-xs leading-snug text-stitch-text shadow-lg',
          'opacity-0 transition-opacity duration-150',
          open && 'opacity-100',
          'md:group-hover/hint:opacity-100 md:group-focus-within/hint:opacity-100',
        )}
      >
        {text}
      </span>
    </span>
  );
}

export const COMMUNITY_MEMBER_COUNT_HINT =
  'Учитываются те, кто уже подключился к Meriter: открыли мини-приложение, написали в чат или проголосовали. Участники группы без такой активности в счётчик не входят.';
