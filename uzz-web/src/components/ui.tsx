import { cn } from '@/lib/utils';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

export const userContentClass = 'user-content min-w-0 max-w-full [overflow-wrap:anywhere]';

export function Button({ children, className, variant = 'primary', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  return (
    <button {...props} className={cn(
      'min-h-11 rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stitch-accent focus-visible:ring-offset-2 focus-visible:ring-offset-stitch-canvas disabled:cursor-not-allowed',
      variant === 'primary' && 'bg-stitch-accent-solid text-white hover:bg-stitch-accent-solid-hover disabled:bg-stitch-accent-disabled-bg disabled:text-stitch-accent-disabled-fg',
      variant === 'ghost' && 'border border-stitch-border bg-transparent text-stitch-text hover:border-stitch-accent hover:bg-stitch-accent/10 disabled:opacity-50',
      variant === 'danger' && 'border border-red-400/60 bg-red-500/10 text-red-200 hover:bg-red-500/20 disabled:opacity-50',
      className,
    )}>{children}</button>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('min-w-0 max-w-full rounded-2xl border border-stitch-border bg-stitch-surface p-5 shadow-[0_14px_40px_rgb(2_6_23_/_0.24)]', className)}>{children}</section>;
}

export function Notice({ children, tone = 'info', className, role = 'status' }: { children: ReactNode; tone?: 'info' | 'warn' | 'ok'; className?: string; role?: 'status' | 'alert' }) {
  return <div role={role} className={cn(
    'rounded-xl border p-4 text-sm leading-6',
    tone === 'warn' && 'border-amber-400/40 bg-amber-400/10 text-amber-100',
    tone === 'ok' && 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100',
    tone === 'info' && 'border-stitch-accent/30 bg-stitch-accent/10 text-stitch-text',
    className,
  )}>{children}</div>;
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'warn' | 'ok' }) {
  return <span className={cn(
    'inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-xs font-medium',
    userContentClass,
    tone === 'neutral' && 'bg-stitch-canvas text-stitch-muted',
    tone === 'accent' && 'bg-stitch-canvas text-stitch-accent-text',
    tone === 'warn' && 'bg-amber-400/10 text-amber-200',
    tone === 'ok' && 'bg-emerald-400/10 text-emerald-200',
  )}>{children}</span>;
}

export function PageHeader({ eyebrow, title, children, actions }: { eyebrow?: string; title: string; children?: ReactNode; actions?: ReactNode }) {
  return <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div className="max-w-2xl space-y-2">
      {eyebrow ? <p className="text-xs font-bold uppercase tracking-[0.16em] text-stitch-accent-text">{eyebrow}</p> : null}
      <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
      {children ? <div className="text-sm leading-6 text-stitch-muted">{children}</div> : null}
    </div>
    {actions ? <div className="shrink-0">{actions}</div> : null}
  </header>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-2xl bg-stitch-surface', className)} aria-hidden />;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return <Card className="border-dashed bg-stitch-surface/60 p-8 text-center"><p className="font-extrabold">{title}</p>{children ? <div className="mt-2 text-sm leading-6 text-stitch-muted">{children}</div> : null}</Card>;
}

export function QueryFailed({ onRetry }: { onRetry?: () => void }) {
  return <Notice tone="warn">Не удалось загрузить данные. {onRetry ? <button type="button" className="font-semibold underline" onClick={onRetry}>Попробовать ещё раз</button> : null}</Notice>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="block space-y-1.5 text-sm"><span className="font-medium text-stitch-text">{label}</span>{children}{hint ? <span className="block text-xs leading-5 text-stitch-muted">{hint}</span> : null}</label>;
}

export function NumberField(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="number" inputMode="numeric" {...props} className={cn(inputClass, props.className)} />;
}

export const inputClass = 'min-h-11 w-full rounded-xl border border-stitch-border bg-stitch-canvas px-3 py-2 text-sm text-stitch-text placeholder:text-stitch-muted/70 outline-none transition focus:border-stitch-accent focus:ring-2 focus:ring-stitch-accent/40';
