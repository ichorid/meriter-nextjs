'use client';

import { useRouter } from 'next/navigation';
import { TruncatedLabel } from '@/components/truncated-label';
import type { TelegramCommunityOption } from '@/lib/tg-boot-resolve';

type TgCommunityPickerProps = {
  communities: TelegramCommunityOption[];
};

export function TgCommunityPicker({ communities }: TgCommunityPickerProps) {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col bg-stitch-canvas px-4 py-8 pt-[calc(1.5rem+env(safe-area-inset-top))]">
      <h1 className="text-lg font-bold tracking-tight text-stitch-text">Выберите сообщество</h1>
      <p className="mt-2 text-sm text-stitch-muted">
        Вы состоите в нескольких группах Meriter. Выберите, для какой открыть баланс и историю
        заслуг.
      </p>
      <ul className="mt-6 flex flex-col gap-2">
        {communities.map((item) => (
          <li key={item.communityId}>
            <button
              type="button"
              onClick={() => router.replace(`/c/${item.communityId}/me`)}
              className="w-full rounded-xl border border-stitch-border bg-stitch-surface px-4 py-3 text-left text-sm font-medium text-stitch-text transition-colors hover:border-primary/40 hover:bg-stitch-elevated"
            >
              <TruncatedLabel text={item.name} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
