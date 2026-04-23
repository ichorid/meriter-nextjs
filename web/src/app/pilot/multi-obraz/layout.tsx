import type { Metadata } from 'next';
import { MultiObrazPilotChrome } from '@/features/multi-obraz-pilot/MultiObrazPilotChrome';

export const metadata: Metadata = {
  title: 'Мультиобраз — пилот',
  robots: { index: false, follow: false },
};

export default function PilotMultiObrazLayout({ children }: { children: React.ReactNode }) {
  return <MultiObrazPilotChrome>{children}</MultiObrazPilotChrome>;
}
