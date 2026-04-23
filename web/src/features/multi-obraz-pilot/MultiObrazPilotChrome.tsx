'use client';

import { PilotMinimalNav } from '@/features/multi-obraz-pilot/PilotMinimalNav';

export function MultiObrazPilotChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#0f172a] text-[#f1f5f9]">
      <PilotMinimalNav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
