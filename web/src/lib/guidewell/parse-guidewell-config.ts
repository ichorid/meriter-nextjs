export interface GuidewellWidgetConfig {
  enabled: boolean;
  apiBase: string;
  apiKey: string;
  fabText: string;
  fabTextRu: string;
  chat: string;
  ai: boolean;
  primaryColor: string;
}

export type GuidewellEnvSource = {
  NEXT_PUBLIC_GUIDEWELL_ENABLED?: string;
  NEXT_PUBLIC_GUIDEWELL_API_BASE?: string;
  NEXT_PUBLIC_GUIDEWELL_API_KEY?: string;
  NEXT_PUBLIC_GUIDEWELL_FAB_TEXT?: string;
  NEXT_PUBLIC_GUIDEWELL_FAB_TEXT_RU?: string;
  NEXT_PUBLIC_GUIDEWELL_CHAT?: string;
  NEXT_PUBLIC_GUIDEWELL_AI?: string;
  NEXT_PUBLIC_GUIDEWELL_PRIMARY_COLOR?: string;
};

/** Read Guidewell settings from runtime env (server) or build-time env (client config). */
export function parseGuidewellConfig(source: GuidewellEnvSource): GuidewellWidgetConfig {
  const apiKey = (source.NEXT_PUBLIC_GUIDEWELL_API_KEY || '').trim();
  const apiBase = (source.NEXT_PUBLIC_GUIDEWELL_API_BASE || '').replace(/\/$/, '').trim();

  return {
    enabled:
      source.NEXT_PUBLIC_GUIDEWELL_ENABLED === 'true' && apiKey.length > 0 && apiBase.length > 0,
    apiBase,
    apiKey,
    fabText: source.NEXT_PUBLIC_GUIDEWELL_FAB_TEXT || 'Help',
    fabTextRu: source.NEXT_PUBLIC_GUIDEWELL_FAB_TEXT_RU || 'Помощь',
    chat: source.NEXT_PUBLIC_GUIDEWELL_CHAT || 'both',
    ai: source.NEXT_PUBLIC_GUIDEWELL_AI !== 'false',
    primaryColor: source.NEXT_PUBLIC_GUIDEWELL_PRIMARY_COLOR || '#A855F7',
  };
}
