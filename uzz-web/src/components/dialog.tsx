'use client';

import { useLayoutEffect, useRef, type MouseEvent, type ReactNode } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function isShown(element: HTMLElement): boolean {
  if (element.hidden || element.closest('[hidden]')) return false;
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function focusableIn(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => (
    !element.hasAttribute('disabled')
    && element.getAttribute('aria-disabled') !== 'true'
    && isShown(element)
  ));
}

export function DialogTitle({ id, children }: { id: string; children: ReactNode }) {
  return <h2 id={id} className="text-xl font-black tracking-tight">{children}</h2>;
}

export function Dialog({
  open,
  onClose,
  labelledBy,
  describedBy,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  describedBy?: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useLayoutEffect(() => {
    if (!open) return undefined;

    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;

    const focusFirst = () => {
      const root = panelRef.current;
      if (root) focusableIn(root)[0]?.focus();
    };
    const frame = window.requestAnimationFrame(focusFirst);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const root = panelRef.current;
      if (!root) return;
      const items = focusableIn(root);
      if (!items.length) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey) {
        if (active === first || !root.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !root.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      previous?.focus();
    };
  }, [open]);

  if (!open) return null;

  function onBackdrop(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className="fixed inset-0 z-50 grid place-items-end bg-black/70 p-0 sm:place-items-center sm:p-6"
      onMouseDown={onBackdrop}
    >
      <div ref={panelRef} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-stitch-border bg-stitch-surface p-5 sm:rounded-2xl sm:p-6">
        {children}
      </div>
    </div>
  );
}
