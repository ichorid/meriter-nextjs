import { redirect } from 'next/navigation';
import { isPilotClientMode } from '@/config/pilot';
import { PilotProfilePageClient } from '@/features/multi-obraz-pilot/PilotProfilePageClient';
import { getMultiObrazMessages, getPilotServerLocale } from '@/lib/i18n/pilot-messages-server';

export async function generateMetadata() {
  if (!isPilotClientMode()) {
    return { title: 'Meriter' };
  }
  const locale = await getPilotServerLocale();
  const m = getMultiObrazMessages(locale);
  return {
    title: `${m.navProfile} — ${m.brand}`,
    robots: { index: false, follow: false } as const,
  };
}

export default function PilotProfilePage() {
  if (!isPilotClientMode()) {
    redirect('/meriter/profile');
  }
  return <PilotProfilePageClient />;
}
