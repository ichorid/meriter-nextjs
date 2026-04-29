'use client';

import { PilotMinimalNav } from '@/features/multi-obraz-pilot/PilotMinimalNav';
import { PilotMeritsLine } from '@/features/multi-obraz-pilot/PilotMeritsLine';

export function MultiObrazPilotChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#0f172a] text-[#f1f5f9]">
      <PilotMinimalNav />
      <div className="border-b border-[#334155]/50 py-2">
        <PilotMeritsLine />
      </div>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
