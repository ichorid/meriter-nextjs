import { isPilotClientMode } from '@/config/pilot';
import { MultiObrazPilotChrome } from '@/features/multi-obraz-pilot/MultiObrazPilotChrome';
import { PilotMiningPageClient } from '@/features/multi-obraz-pilot/PilotMiningPageClient';
import { redirect } from 'next/navigation';

export default function MiningPage() {
  if (!isPilotClientMode()) {
    redirect('/meriter/profile');
  }
  return (
    <MultiObrazPilotChrome>
      <PilotMiningPageClient />
    </MultiObrazPilotChrome>
  );
}

