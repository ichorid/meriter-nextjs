import { redirect } from 'next/navigation';
import { isPilotClientMode } from '@/config/pilot';
import { MultiObrazPilotChrome } from '@/features/multi-obraz-pilot/MultiObrazPilotChrome';
import { PilotMultiObrazHomeClient } from '@/features/multi-obraz-pilot/PilotMultiObrazHomeClient';
import { getMultiObrazMessages, getPilotServerLocale } from '@/lib/i18n/pilot-messages-server';

export async function generateMetadata() {
  if (isPilotClientMode()) {
    const locale = await getPilotServerLocale();
    const m = getMultiObrazMessages(locale);
    return {
      title: m.brand,
      robots: { index: false, follow: false } as const,
    };
  }
  return { title: 'Meriter' };
}
export default function Home() {
  if (isPilotClientMode()) {
    return (
      <MultiObrazPilotChrome>
        <PilotMultiObrazHomeClient />
      </MultiObrazPilotChrome>
    );
  }
  redirect('/meriter/profile');
}