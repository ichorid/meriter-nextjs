'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { usePilotDreamUpvote, usePilotDreamsFeed, usePilotMeritsStats } from '@/hooks/api/useProjects';
import { useDebounce } from '@/hooks/useDebounce';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { routes } from '@/lib/constants/routes';
import { pilotCreateHref, pilotDreamHref } from '@/lib/constants/pilot-routes';
import { cn } from '@/lib/utils';
import { CalendarDays, Minus, Plus, TrendingUp } from 'lucide-react';
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
import { formatMerits } from '@/lib/utils/currency';
import { ImageLightbox } from '@/shared/components/image-lightbox';
import { PilotDreamCoverImage } from '@/features/multi-obraz-pilot/PilotDreamCoverImage';

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

const FEED_SEARCH_DEBOUNCE_MS = 300;

export function PilotMultiObrazHomeClient() {
  const t = useTranslations('multiObraz');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [sortMode, setSortMode] = React.useState<'score' | 'createdAt'>(() =>
    searchParams.get('sort') === 'createdAt' ? 'createdAt' : 'score',
  );
  const [searchInput, setSearchInput] = React.useState(() => searchParams.get('q') ?? '');
  const debouncedSearch = useDebounce(searchInput, FEED_SEARCH_DEBOUNCE_MS);

  const { data, isLoading, isFetching } = usePilotDreamsFeed({
    page: 1,
    pageSize: 20,
    sort: sortMode,
    search: debouncedSearch,
  });
  const upvoteDream = usePilotDreamUpvote();
  const { data: stats } = usePilotMeritsStats();

  React.useEffect(() => {
    const params = new URLSearchParams();
    if (sortMode !== 'score') {
      params.set('sort', sortMode);
    }
    const q = debouncedSearch.trim();
    if (q) {
      params.set('q', q);
    }
    const qs = params.toString();
    const next = qs ? `${pathname}?${qs}` : pathname;
    router.replace(next, { scroll: false });
  }, [sortMode, debouncedSearch, pathname, router]);

  const [supportOpen, setSupportOpen] = React.useState(false);
  const [supportDreamId, setSupportDreamId] = React.useState<string | null>(null);
  const [supportIsOwnDream, setSupportIsOwnDream] = React.useState(false);
  const [supportAmount, setSupportAmount] = React.useState<number>(1);
  const [supportAmountInput, setSupportAmountInput] = React.useState<string>('1');

  const [loreOpen, setLoreOpen] = React.useState(false);
  const [loreText, setLoreText] = React.useState<string | null>(null);
  const [loreLoading, setLoreLoading] = React.useState(false);
  const [coverLightboxUrl, setCoverLightboxUrl] = React.useState<string | null>(null);

  const openSupport = (dreamId: string, isOwn: boolean) => {
    setSupportDreamId(dreamId);
    setSupportIsOwnDream(isOwn);
    setSupportAmount(1);
    setSupportAmountInput('1');
    setSupportOpen(true);
  };

  const quotaRemainingRaw = stats?.quota?.remaining ?? 0;
  const quotaRemaining = supportIsOwnDream ? 0 : quotaRemainingRaw;
  const dailyQuota = stats?.quota?.dailyQuota ?? 100;
  const walletBalance = stats?.walletBalance ?? 0;
  const maxAvailable = Math.max(0, quotaRemaining + walletBalance);

  const clampAmount = (raw: number) => {
    if (!Number.isFinite(raw)) return 1;
    const n = Math.floor(raw);
    const min = 1;
    const max = Math.max(1, maxAvailable);
    return Math.min(max, Math.max(min, n));
  };

  const getAmountFromInput = React.useCallback((): number => {
    const digitsOnly = (supportAmountInput ?? '').replace(/\D/g, '');
    if (!digitsOnly) return clampAmount(supportAmount || 1);
    const parsed = Number.parseInt(digitsOnly, 10);
    return clampAmount(parsed);
  }, [supportAmountInput, supportAmount, maxAvailable]);

  const setSupportAmountClamped = React.useCallback(
    (raw: number) => {
      const next = clampAmount(raw);
      setSupportAmount(next);
      setSupportAmountInput(String(next));
    },
    [maxAvailable],
  );

  const setSupportAmountFromInput = (raw: string) => {
    const digitsOnly = raw.replace(/\D/g, '');
    if (!digitsOnly) {
      setSupportAmountInput('');
      return;
    }
    const parsed = Number.parseInt(digitsOnly, 10);
    setSupportAmountClamped(parsed);
  };

  React.useEffect(() => {
    if (!supportOpen) return;
    setSupportAmountClamped(supportAmount || 1);
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
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = (await res.json()) as { success?: boolean; data?: string; error?: { message?: string } };
        if (!res.ok || json?.success === false) {
          setLoreText(json?.error?.message || t('loreLoadFailed'));
        } else {
          setLoreText(json?.data ?? '');
        }
      } else {
        const txt = await res.text();
        setLoreText(txt);
      }
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

        <div className="flex flex-nowrap items-center gap-2 sm:gap-3">
          <div
            className="flex h-11 shrink-0 items-center gap-0.5 rounded-xl border border-[#334155] bg-[#0f172a] p-0.5"
            role="group"
            aria-label={t('feedSortLabel')}
          >
            <button
              type="button"
              onClick={() => setSortMode('score')}
              aria-label={t('feedSortRating')}
              aria-pressed={sortMode === 'score'}
              title={t('feedSortRating')}
              className={cn(
                'inline-flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors',
                sortMode === 'score'
                  ? 'bg-[#A855F7] text-white shadow-sm'
                  : 'text-[#94a3b8] hover:bg-white/5 hover:text-[#e2e8f0]',
              )}
            >
              <TrendingUp className="size-5" strokeWidth={2} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setSortMode('createdAt')}
              aria-label={t('feedSortDate')}
              aria-pressed={sortMode === 'createdAt'}
              title={t('feedSortDate')}
              className={cn(
                'inline-flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors',
                sortMode === 'createdAt'
                  ? 'bg-[#A855F7] text-white shadow-sm'
                  : 'text-[#94a3b8] hover:bg-white/5 hover:text-[#e2e8f0]',
              )}
            >
              <CalendarDays className="size-5" strokeWidth={2} aria-hidden />
            </button>
          </div>
          <div className="min-w-0 flex-1">
            <Input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t('feedSearchPlaceholder')}
              aria-label={t('feedSearchPlaceholder')}
              className="h-11 rounded-xl border-[#334155] bg-[#0f172a] text-[#f1f5f9] placeholder:text-[#64748b] focus-visible:ring-[#A855F7]"
            />
          </div>
        </div>

        {isFetching && !isLoading ? (
          <p className="text-xs text-[#64748b]" aria-live="polite">
            {t('feedUpdating')}
          </p>
        ) : null}

        {isLoading ? (
          <p className="text-sm text-[#94a3b8]">{tCommon('loading')}</p>
        ) : !data?.data?.length ? (
          <p className="text-sm text-[#94a3b8]">
            {debouncedSearch.trim() ? t('feedSearchEmpty') : t('feedEmpty')}
          </p>
        ) : (
          <ul
            className={cn(
              'space-y-3 transition-opacity duration-150',
              isFetching && !isLoading ? 'opacity-75' : 'opacity-100',
            )}
          >
            {data.data.map((row) => {
              const published = formatPublishedAt(row.project.createdAt, locale);
              const author = row.founderDisplayName?.trim() || null;
              return (
                <li key={row.project.id}>
                  <div
                    className={cn(
                      'overflow-hidden rounded-xl border border-[#334155] bg-[#1e293b] transition-colors hover:border-[#A855F7]/50 hover:bg-[#1e293b]/90',
                    )}
                  >
                    {row.project.coverImageUrl ? (
                      <button
                        type="button"
                        onClick={() => setCoverLightboxUrl(row.project.coverImageUrl ?? null)}
                        className="relative block w-full text-left"
                        aria-label={t('dreamCoverOpenLightbox')}
                      >
                        <PilotDreamCoverImage
                          src={row.project.coverImageUrl}
                          className="bg-[#1e293b]"
                        />
                      </button>
                    ) : null}
                    <Link href={pilotDreamHref(row.project.id)} className="block">
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
                                openSupport(row.project.id, Boolean(user?.id && row.project.founderUserId === user.id));
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
                  </div>
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
              {supportIsOwnDream ? t('supportDialogBodyOwnDream') : t('supportDialogBody')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="support-amount">{t('supportAmountLabel')}</Label>

            {stats ? (
              <div className="flex gap-2">
                {quotaRemaining > 0 ? (
                  <div className="flex-[1] space-y-1">
                    <div className="text-xs font-medium text-[#94a3b8]">{t('quotaLabel')}</div>
                    <div className="relative h-3 overflow-hidden rounded-full bg-[#0f172a] ring-1 ring-[#334155]">
                      {(() => {
                        const amt = getAmountFromInput();
                        const usedQuota = Math.min(amt, quotaRemaining);
                        const fillPercent = Math.min(100, (usedQuota / Math.max(1, quotaRemaining)) * 100);
                        return fillPercent > 0 ? (
                          <div
                            className="absolute inset-y-0 left-0 bg-[#A855F7]"
                            style={{ width: `${fillPercent}%` }}
                          />
                        ) : null;
                      })()}
                    </div>
                    <div className="text-[11px] tabular-nums text-[#94a3b8]">
                      {Math.min(getAmountFromInput(), quotaRemaining)}/{quotaRemaining}
                    </div>
                  </div>
                ) : null}

                {walletBalance > 0 ? (
                  <div className={quotaRemaining > 0 ? 'flex-[3] space-y-1' : 'flex-1 space-y-1'}>
                    <div className="text-xs font-medium text-[#94a3b8]">{t('walletLabel')}</div>
                    <div className="relative h-3 overflow-hidden rounded-full bg-[#0f172a] ring-1 ring-[#334155]">
                      {(() => {
                        const amt = getAmountFromInput();
                        const usedWallet = Math.max(0, amt - quotaRemaining);
                        const fillPercent = Math.min(100, (usedWallet / Math.max(1, walletBalance)) * 100);
                        return fillPercent > 0 ? (
                          <div
                            className="absolute inset-y-0 left-0 bg-[#7C3AED]"
                            style={{ width: `${fillPercent}%` }}
                          />
                        ) : null;
                      })()}
                    </div>
                    <div className="text-[11px] tabular-nums text-[#94a3b8]">
                      {Math.max(0, getAmountFromInput() - quotaRemaining)}/{walletBalance}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex items-stretch gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-12 w-12 shrink-0 rounded-xl border-[#334155] bg-[#0f172a] p-0 text-white"
                onClick={() => setSupportAmountClamped(getAmountFromInput() - 1)}
                disabled={upvoteDream.isPending || getAmountFromInput() <= 1}
                aria-label={t('decrease')}
              >
                <Minus className="h-5 w-5" aria-hidden />
              </Button>

              <div className="relative h-12 w-full overflow-hidden rounded-xl border border-[#334155] bg-[#0f172a]">
                <input
                  id="support-amount"
                  type="text"
                  inputMode="numeric"
                  min={1}
                  max={Math.max(1, maxAvailable)}
                  value={supportAmountInput}
                  onChange={(e) => setSupportAmountFromInput(e.target.value)}
                  onBlur={() => {
                    setSupportAmountClamped(getAmountFromInput());
                  }}
                  className="relative z-10 h-full w-full bg-transparent px-3 text-center text-lg font-semibold tabular-nums text-white outline-none"
                />
              </div>

              <Button
                type="button"
                variant="outline"
                className="h-12 w-12 shrink-0 rounded-xl border-[#334155] bg-[#0f172a] p-0 text-white"
                onClick={() => setSupportAmountClamped(getAmountFromInput() + 1)}
                disabled={upvoteDream.isPending || getAmountFromInput() >= Math.max(1, maxAvailable)}
                aria-label={t('increase')}
              >
                <Plus className="h-5 w-5" aria-hidden />
              </Button>
            </div>

            {stats ? (
              <div className="pt-1 text-xs text-[#94a3b8]">
                {supportIsOwnDream
                  ? t('supportAvailableWalletOnly', { wallet: walletBalance })
                  : t('supportAvailable', { quota: quotaRemaining, wallet: walletBalance })}
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

      <ImageLightbox
        images={coverLightboxUrl ? [coverLightboxUrl] : []}
        isOpen={Boolean(coverLightboxUrl)}
        onClose={() => setCoverLightboxUrl(null)}
        altPrefix={t('dreamCoverAlt')}
      />
    </div>
  );
}
