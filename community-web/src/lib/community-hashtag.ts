export function primaryCommunityHashtag(hashtags?: string[]): string {
  const tag = (hashtags?.[0] ?? 'идея').replace(/^#/, '').trim();
  return tag || 'идея';
}

export function meritTransferWalletHint(hashtag: string): string {
  return `Перевод — с кошелька. Ежедневные заслуги — на голоса за посты с #${hashtag}.`;
}
