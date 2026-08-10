export type CommunityHubFeedTab = 'posts' | 'projects' | 'events' | 'birzha';

const KNOWN_NON_POST = new Set<string>(['projects', 'events', 'birzha']);

export function parseCommunityHubFeedTabParam(
  raw: string | null | undefined,
): CommunityHubFeedTab | null {
  if (!raw || !KNOWN_NON_POST.has(raw)) return null;
  return raw as CommunityHubFeedTab;
}

export function isUnknownCommunityHubFeedTabParam(
  raw: string | null | undefined,
): boolean {
  return Boolean(raw && !KNOWN_NON_POST.has(raw));
}

export function resolveCommunityHubFeedTab(
  raw: string | null | undefined,
  visibleTabs: readonly CommunityHubFeedTab[],
): CommunityHubFeedTab {
  const parsed = parseCommunityHubFeedTabParam(raw);
  if (parsed && visibleTabs.includes(parsed)) return parsed;
  return 'posts';
}

export function needsCommunityHubFeedTabSanitize(
  raw: string | null | undefined,
  visibleTabs: readonly CommunityHubFeedTab[],
): boolean {
  if (isUnknownCommunityHubFeedTabParam(raw)) return true;
  const parsed = parseCommunityHubFeedTabParam(raw);
  return Boolean(parsed && !visibleTabs.includes(parsed));
}

export function buildCommunityHubFeedTabHref(
  pathname: string,
  searchParams: URLSearchParams | ReadonlyURLSearchParams | string | null | undefined,
  tab: CommunityHubFeedTab,
): string {
  const p = new URLSearchParams(
    typeof searchParams === 'string'
      ? searchParams
      : (searchParams?.toString() ?? ''),
  );
  if (tab === 'posts') {
    p.delete('feedTab');
  } else {
    p.set('feedTab', tab);
  }
  const q = p.toString();
  return q ? `${pathname}?${q}` : pathname;
}
