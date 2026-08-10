'use client';

import { useId, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type TruncatedLabelProps = {
  text: string;
  className?: string;
};

/**
 * Single-line label; tap toggles full text when visually truncated.
 */
export function TruncatedLabel({ text, className }: TruncatedLabelProps) {
  const textRef = useRef<HTMLSpanElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;

    const check = () => {
      setIsTruncated(el.scrollWidth > el.clientWidth + 1);
    };

    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text]);

  const label = (
    <span ref={textRef} className="block truncate">
      {text}
    </span>
  );

  return (
    <span className={cn('relative min-w-0', className)}>
      {isTruncated ? (
        <button
          type="button"
          className="block w-full min-w-0 truncate text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-sm"
          aria-label={text}
          aria-expanded={open}
          aria-describedby={open ? tooltipId : undefined}
          onClick={() => setOpen((value) => !value)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setOpen(false);
            }
          }}
        >
          {label}
        </button>
      ) : (
        label
      )}
      {isTruncated && (
        <span
          id={tooltipId}
          role="tooltip"
          className={cn(
            'pointer-events-none absolute left-0 top-[calc(100%+0.35rem)] z-30 w-max max-w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-stitch-border bg-stitch-elevated px-3 py-2 text-left text-xs font-normal leading-snug text-stitch-text shadow-lg',
            'opacity-0 transition-opacity duration-150',
            open && 'opacity-100',
          )}
        >
          {text}
        </span>
      )}
    </span>
  );
}
