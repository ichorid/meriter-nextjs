'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { usePilotDreamsFeed } from '@/hooks/api/useProjects';
import { Button } from '@/components/ui/shadcn/button';
import { routes } from '@/lib/constants/routes';
import { pilotCreateHref } from '@/lib/constants/pilot-routes';
import { cn } from '@/lib/utils';

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

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-[#334155] bg-[#1e293b] p-6 sm:p-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{t('heroTitle')}</h1>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-[#94a3b8] sm:text-base">{t('heroBody')}</p>
        <div className="mt-6">
          {user ? (
            <Button
              asChild
              className="h-12 min-w-[200px] rounded-lg bg-[#A855F7] px-6 text-base font-semibold text-white hover:bg-[#9333ea]"
            >
              <Link href={pilotCreateHref()}>{t('heroCta')}</Link>
            </Button>
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
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
