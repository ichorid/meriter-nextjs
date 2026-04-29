'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { usePilotDreamUpvote, usePilotDreamsFeed, usePilotMeritsStats } from '@/hooks/api/useProjects';
import { Button } from '@/components/ui/shadcn/button';
import { routes } from '@/lib/constants/routes';
import { pilotCreateHref } from '@/lib/constants/pilot-routes';
import { cn } from '@/lib/utils';
import { TrendingUp } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';
import { Label } from '@/components/ui/shadcn/label';
import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Minus, Plus } from 'lucide-react';
import { formatMerits } from '@/lib/utils/currency';

function formatPublishedAt(iso: string | undefined, locale: string): string | null {
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

export function PilotMultiObrazHomeClient() {
  const t = useTranslations('multiObraz');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const { user } = useAuth();
  const { data, isLoading } = usePilotDreamsFeed({ page: 1, pageSize: 20 });
  const upvoteDream = usePilotDreamUpvote();
  const { data: stats } = usePilotMeritsStats();

  const [supportOpen, setSupportOpen] = React.useState(false);
  const [supportDreamId, setSupportDreamId] = React.useState<string | null>(null);
  const [supportAmount, setSupportAmount] = React.useState<number>(1);
  const [supportAmountInput, setSupportAmountInput] = React.useState<string>('1');

  const [loreOpen, setLoreOpen] = React.useState(false);
  const [loreText, setLoreText] = React.useState<string | null>(null);
  const [loreLoading, setLoreLoading] = React.useState(false);

  const openSupport = (dreamId: string) => {
    setSupportDreamId(dreamId);
    setSupportAmount(1);
    setSupportAmountInput('1');
    setSupportOpen(true);
  };

  const quotaRemaining = stats?.quota?.remaining ?? 0;
  const dailyQuota = stats?.quota?.dailyQuota ?? 10;
  const walletBalance = stats?.walletBalance ?? 0;
  const maxAvailable = Math.min(100, Math.max(0, quotaRemaining + walletBalance));

  const clampAmount = (raw: number) => {
    if (!Number.isFinite(raw)) return 1;
    const n = Math.floor(raw);
    const min = 1;
    const max = Math.max(1, maxAvailable);
    return Math.min(max, Math.max(min, n));
  };

  const setSupportAmountFromInput = (raw: string) => {
    const digitsOnly = raw.replace(/\D/g, '');
    if (!digitsOnly) {
      setSupportAmountInput('');
      return;
    }
    const parsed = Number.parseInt(digitsOnly, 10);
    const next = clampAmount(parsed);
    setSupportAmount(next);
    setSupportAmountInput(String(next));
  };

  React.useEffect(() => {
    if (!supportOpen) return;
    const next = clampAmount(supportAmount || 1);
    if (next !== supportAmount) setSupportAmount(next);
    if (supportAmountInput !== String(next)) setSupportAmountInput(String(next));
  }, [supportOpen, maxAvailable]);

  const submitSupport = () => {
    if (!supportDreamId) return;
    const amt = clampAmount(supportAmount || 1);
    upvoteDream.mutate(
      { dreamId: supportDreamId, amount: amt },
      {
        onSuccess: () => {
          setSupportOpen(false);
          setSupportDreamId(null);
        },
      },
    );
  };

  const openLore = async () => {
    setLoreOpen(true);
    if (loreText != null || loreLoading) return;
    setLoreLoading(true);
    try {
      const res = await fetch('/api/pilot/lore');
      const txt = await res.text();
      setLoreText(txt);
    } catch {
      setLoreText(t('loreLoadFailed'));
    } finally {
      setLoreLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-[#334155] bg-[#1e293b] p-6 sm:p-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{t('heroTitle')}</h1>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-[#94a3b8] sm:text-base">{t('heroBody')}</p>
        <div className="mt-6">
          {user ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                asChild
                className="h-12 min-w-[200px] rounded-lg bg-[#A855F7] px-6 text-base font-semibold text-white hover:bg-[#9333ea]"
              >
                <Link href={pilotCreateHref()}>{t('heroCta')}</Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-12 min-w-[200px] rounded-lg border-[#334155] bg-[#0f172a] px-6 text-base font-semibold text-white hover:bg-[#0f172a]/80"
                onClick={openLore}
              >
                {t('aboutMeriterra')}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild className="h-12 rounded-lg bg-[#A855F7] px-6 text-white hover:bg-[#9333ea]">
                <Link href={routes.login}>{t('navLogin')}</Link>
              </Button>
              <p className="text-sm text-[#94a3b8]">{t('guestCtaHint')}</p>
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="pilot-feed-title" className="space-y-4">
        <h2 id="pilot-feed-title" className="text-lg font-bold text-white">
          {t('feedTitle')}
        </h2>
        {isLoading ? (
          <p className="text-sm text-[#94a3b8]">{tCommon('loading')}</p>
        ) : !data?.data?.length ? (
          <p className="text-sm text-[#94a3b8]">{t('feedEmpty')}</p>
        ) : (
          <ul className="space-y-3">
            {data.data.map((row) => {
              const published = formatPublishedAt(row.project.createdAt, locale);
              const author = row.founderDisplayName?.trim() || null;
              return (
                <li key={row.project.id}>
                  <Link
                    href={routes.project(row.project.id)}
                    className={cn(
                      'block overflow-hidden rounded-xl border border-[#334155] bg-[#1e293b] transition-colors hover:border-[#A855F7]/50 hover:bg-[#1e293b]/90',
                    )}
                  >
                    {row.project.coverImageUrl ? (
                      <img
                        src={row.project.coverImageUrl}
                        alt=""
                        className="h-36 w-full object-cover"
                      />
                    ) : null}
                    <div className="p-4">
                      <div className="font-semibold text-white">{row.project.name}</div>
                      {author || published ? (
                        <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-xs text-[#94a3b8]">
                          {author ? <span className="text-[#cbd5e1]">{author}</span> : null}
                          {author && published ? (
                            <span className="text-[#64748b]" aria-hidden>
                              ·
                            </span>
                          ) : null}
                          {published ? (
                            <time dateTime={row.project.createdAt}>{published}</time>
                          ) : null}
                        </div>
                      ) : null}
                      {row.project.description ? (
                        <p className="mt-2 line-clamp-2 text-sm text-[#94a3b8]">{row.project.description}</p>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2 border-t border-[#334155] px-4 py-3">
                      <div className="w-10" aria-hidden />
                      <div className="flex flex-1 items-center justify-center gap-1 text-sm text-[#cbd5e1]">
                        <TrendingUp className="h-4 w-4 text-[#94a3b8]" aria-hidden />
                        <span className="tabular-nums">{row.project.pilotDreamRating?.score ?? 0}</span>
                      </div>
                      <div className="flex w-28 justify-end">
                        {user ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              openSupport(row.project.id);
                            }}
                            disabled={upvoteDream.isPending}
                            className="h-8 rounded-lg border border-[#334155] bg-[#0f172a] px-3 text-xs text-white hover:bg-[#0f172a]/80"
                          >
                            {t('upvoteDream')}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Dialog open={supportOpen} onOpenChange={setSupportOpen}>
        <DialogContent className="border-[#334155] bg-[#1e293b] text-[#f1f5f9]">
          <DialogHeader>
            <DialogTitle>{t('supportDialogTitle')}</DialogTitle>
            <DialogDescription className="text-[#94a3b8]">
              {t('supportDialogBody')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="support-amount">{t('supportAmountLabel')}</Label>
            <div className="flex items-stretch gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-12 w-12 shrink-0 rounded-xl border-[#334155] bg-[#0f172a] p-0 text-white"
                onClick={() => setSupportAmount((v) => clampAmount((v || 1) - 1))}
                disabled={upvoteDream.isPending || clampAmount(supportAmount) <= 1}
                aria-label={t('decrease')}
              >
                <Minus className="h-5 w-5" aria-hidden />
              </Button>

              <div className="relative h-12 w-full overflow-hidden rounded-xl border border-[#334155] bg-[#0f172a]">
                {/* Fill layers inside the input */}
                {maxAvailable > 0 ? (
                  <>
                    {(() => {
                      const amt = clampAmount(supportAmount);
                      const totalPct = Math.max(0, Math.min(100, (amt / maxAvailable) * 100));
                      const quotaPart = Math.min(amt, quotaRemaining);
                      const quotaPct = Math.max(0, Math.min(100, (quotaPart / maxAvailable) * 100));
                      const walletPct = Math.max(0, totalPct - quotaPct);
                      const hasBoth = quotaPart > 0 && amt > quotaPart;
                      return (
                        <>
                          {/* Total fill: vivid purple gradient */}
                          <div
                            className="absolute inset-y-0 left-0"
                            style={{
                              width: `${totalPct}%`,
                              background: 'linear-gradient(90deg, #A855F7 0%, #9333EA 100%)',
                              opacity: 0.55,
                            }}
                          />
                          {/* Wallet part overlay: slightly darker tint (still purple) */}
                          {walletPct > 0 ? (
                            <div
                              className="absolute inset-y-0"
                              style={{
                                left: `${quotaPct}%`,
                                width: `${walletPct}%`,
                                background: 'linear-gradient(90deg, #7C3AED 0%, #6D28D9 100%)',
                                opacity: 0.55,
                              }}
                            />
                          ) : null}
                          {/* Divider when both quota and wallet are used */}
                          {hasBoth ? (
                            <div
                              className="absolute inset-y-2 w-px bg-white/30"
                              style={{ left: `${quotaPct}%` }}
                            />
                          ) : null}
                        </>
                      );
                    })()}
                  </>
                ) : null}

                <input
                  id="support-amount"
                  type="text"
                  inputMode="numeric"
                  min={1}
                  max={Math.max(1, maxAvailable)}
                  value={supportAmountInput}
                  onChange={(e) => setSupportAmountFromInput(e.target.value)}
                  onBlur={() => {
                    const next = clampAmount(supportAmount || 1);
                    setSupportAmount(next);
                    setSupportAmountInput(String(next));
                  }}
                  className="relative z-10 h-full w-full bg-transparent px-3 text-center text-lg font-semibold tabular-nums text-white outline-none"
                />
              </div>

              <Button
                type="button"
                variant="outline"
                className="h-12 w-12 shrink-0 rounded-xl border-[#334155] bg-[#0f172a] p-0 text-white"
                onClick={() => setSupportAmount((v) => clampAmount((v || 1) + 1))}
                disabled={upvoteDream.isPending || clampAmount(supportAmount) >= Math.max(1, maxAvailable)}
                aria-label={t('increase')}
              >
                <Plus className="h-5 w-5" aria-hidden />
              </Button>
            </div>

            {stats ? (
              <div className="pt-1 text-xs text-[#94a3b8]">
                {t('supportAvailable', { quota: quotaRemaining, wallet: walletBalance })}
              </div>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="border-[#334155] text-white"
              onClick={() => setSupportOpen(false)}
            >
              {tCommon('cancel')}
            </Button>
            <Button
              type="button"
              className="bg-[#A855F7] text-white hover:bg-[#9333ea]"
              onClick={submitSupport}
              disabled={!supportDreamId || upvoteDream.isPending || maxAvailable <= 0}
            >
              {t('supportSubmit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={loreOpen} onOpenChange={setLoreOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto border-[#334155] bg-[#1e293b] text-[#f1f5f9]">
          <DialogHeader>
            <DialogTitle>{t('aboutMeriterra')}</DialogTitle>
            <DialogDescription className="text-[#94a3b8]">
              {t('loreSubtitle')}
            </DialogDescription>
          </DialogHeader>
          {loreLoading ? (
            <p className="text-sm text-[#94a3b8]">{tCommon('loading')}</p>
          ) : (
            <article className="prose prose-invert max-w-none prose-p:text-[#cbd5e1] prose-strong:text-white prose-headings:text-white">
              <ReactMarkdown>{loreText ?? ''}</ReactMarkdown>
            </article>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
