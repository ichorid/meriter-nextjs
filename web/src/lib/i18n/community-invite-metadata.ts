import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import config from '@/config';
import type { Locale } from '@/i18n/request';
import { detectBrowserLanguage } from '@/i18n/request';
import en from '../../../messages/en.json';
import ru from '../../../messages/ru.json';
import { metadataTitle } from '@/lib/i18n/metadata-title';

type MessagesRoot = typeof en;

export interface CommunityInvitePreviewDto {
  communityId: string;
  communityName: string;
  isProject: boolean;
  avatarUrl?: string;
}

function getNestedString(messages: MessagesRoot, dotPath: string): string | undefined {
  const parts = dotPath.split('.');
  let cur: unknown = messages;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in cur) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return typeof cur === 'string' ? cur : undefined;
}

function interpolate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '');
}

async function localeFromRequest(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieVal = cookieStore.get('NEXT_LOCALE')?.value;
  if (cookieVal === 'ru' || cookieVal === 'en') {
    return cookieVal;
  }
  const acceptLang = (await headers()).get('accept-language') ?? undefined;
  return detectBrowserLanguage(acceptLang);
}

function absoluteAppUrl(path: string): string {
  const base = config.app.url.replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function resolveApiBaseUrl(): string {
  return config.api.baseUrl || 'http://localhost:8001';
}

export async function fetchCommunityInvitePreview(
  token: string,
): Promise<CommunityInvitePreviewDto | null> {
  try {
    const input = encodeURIComponent(JSON.stringify({ json: { token } }));
    const response = await fetch(
      `${resolveApiBaseUrl()}/trpc/communities.getCommunityInvitePreview?input=${input}`,
      { cache: 'no-store' },
    );
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as {
      result?: { data?: { json?: CommunityInvitePreviewDto } };
    };
    return data?.result?.data?.json ?? null;
  } catch {
    return null;
  }
}

function buildOgImageUrl(
  preview: CommunityInvitePreviewDto,
  locale: Locale,
): string {
  const params = new URLSearchParams({
    name: preview.communityName,
    locale,
    project: preview.isProject ? '1' : '0',
  });
  if (preview.avatarUrl) {
    params.set('avatar', preview.avatarUrl);
  }
  return absoluteAppUrl(`/og/community-invite?${params.toString()}`);
}

export async function buildCommunityInviteMetadata(options: {
  token: string;
  canonicalPath: string;
}): Promise<Metadata> {
  const locale = await localeFromRequest();
  const messages = (locale === 'ru' ? ru : en) as MessagesRoot;
  const preview = await fetchCommunityInvitePreview(options.token);

  if (!preview) {
    return metadataTitle('metadata.joinCommunity');
  }

  const titleKey = preview.isProject
    ? 'metadata.communityInviteOgTitleProject'
    : 'metadata.communityInviteOgTitle';
  const descriptionKey = preview.isProject
    ? 'metadata.communityInviteOgDescriptionProject'
    : 'metadata.communityInviteOgDescription';

  const title =
    interpolate(getNestedString(messages, titleKey) ?? titleKey, {
      name: preview.communityName,
    }) || preview.communityName;

  const description =
    interpolate(getNestedString(messages, descriptionKey) ?? descriptionKey, {
      name: preview.communityName,
    }) || title;

  const canonicalUrl = absoluteAppUrl(options.canonicalPath);
  const ogImage = buildOgImageUrl(preview, locale);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: 'Meriter',
      type: 'website',
      locale: locale === 'ru' ? 'ru_RU' : 'en_US',
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}
