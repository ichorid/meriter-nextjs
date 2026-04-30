import { isPilotClientMode } from '@/config/pilot';
import { MultiObrazPilotChrome } from '@/features/multi-obraz-pilot/MultiObrazPilotChrome';

export default function PilotDreamLayout({ children }: { children: React.ReactNode }) {
  if (isPilotClientMode()) {
    return <MultiObrazPilotChrome>{children}</MultiObrazPilotChrome>;
  }
  return children;
}

