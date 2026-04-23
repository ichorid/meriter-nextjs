import { getMultiObrazMessages, getPilotServerLocale } from '@/lib/i18n/pilot-messages-server';

export async function generatePilotCreateDreamMetadata() {
  const locale = await getPilotServerLocale();
  const m = getMultiObrazMessages(locale);
  return {
    title: m.heroCta,
    robots: { index: false, follow: false } as const,
  };
}
