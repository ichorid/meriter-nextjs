import { cn } from '@/lib/utils';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function Button({
  children,
  className,
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger';
}) {
  return (
    <button
      {...props}
      className={cn(
        'min-h-11 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stitch-accent disabled:opacity-50',
        variant === 'primary' && 'bg-stitch-accent text-white hover:bg-stitch-accent/90',
        variant === 'ghost' &&
          'border border-stitch-border text-stitch-text hover:border-stitch-accent',
        variant === 'danger' &&
          'border border-stitch-border text-stitch-text hover:border-red-400',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-xl border border-stitch-border bg-stitch-surface p-4 shadow-[0_8px_30px_rgb(2_6_23_/_0.35)]',
        className,
      )}
    >
      {children}
    </section>
  );
}

export function Notice({
  children,
  tone = 'info',
}: {
  children: ReactNode;
  tone?: 'info' | 'warn' | 'ok';
}) {
  return (
    <div
      role="status"
      className={cn(
        'rounded-xl border p-4 text-sm',
        tone === 'warn' && 'border-amber-500/40 bg-amber-500/10 text-amber-100',
        tone === 'ok' && 'border-stitch-accent/40 bg-stitch-accent/10 text-stitch-text',
        tone === 'info' && 'border-stitch-accent/30 bg-stitch-accent/10 text-stitch-text',
      )}
    >
      {children}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded-xl bg-stitch-surface', className)}
      aria-hidden
    />
  );
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <Card className="border-dashed bg-stitch-surface/60 p-6 text-center">
      <p className="font-extrabold">{title}</p>
      {children ? <div className="mt-2 text-sm text-stitch-muted">{children}</div> : null}
    </Card>
  );
}

export function QueryFailed({
  onRetry,
}: {
  onRetry?: () => void;
}) {
  return (
    <Notice tone="warn">
      Не удалось загрузить.{' '}
      {onRetry ? (
        <button type="button" className="underline" onClick={onRetry}>
          Попробовать ещё раз
        </button>
      ) : null}
    </Notice>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="text-stitch-muted">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  'w-full rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2 text-sm text-stitch-text outline-none focus:ring-2 focus:ring-stitch-accent';
