import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const previewState = {
  data: {
    emissionThreshold: 10,
    autoAssignNominal: true,
    defaultNominalRub: 100,
    scanned: 4,
    wouldEmit: 3,
    alreadyHaveBank: 1,
    owners: 2,
    truncated: false,
    alreadyRanAt: null as Date | null,
  },
  isError: false,
};

const mutate = vi.fn();

vi.mock('@/lib/trpc/client', () => ({
  trpc: {
    settings: {
      previewBackfill: { useQuery: () => previewState },
      backfillRights: {
        useMutation: (opts: { onSuccess: (result: { emitted: number; ownersNotified: number }) => void }) => ({
          isPending: false,
          mutate: (input: { communityId: string }) => {
            mutate(input);
            opts.onSuccess({ emitted: 3, ownersNotified: 2 });
          },
        }),
      },
    },
  },
}));

import { AdminBackfillCard } from '@/components/admin-backfill-card';

describe('AdminBackfillCard', () => {
  beforeEach(() => {
    mutate.mockClear();
    previewState.data.alreadyRanAt = null;
    previewState.data.wouldEmit = 3;
  });

  it('asks for confirmation before running the one-shot backfill', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(
      <AdminBackfillCard
        communityId="community-1"
        onDone={onDone}
        onError={vi.fn()}
      />,
    );
    expect(screen.getByText(/Будет выдано/)).toHaveTextContent('3');
    await user.click(screen.getByRole('button', { name: 'Выдать банки за прошлые дела' }));
    expect(mutate).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Выдать банки' }));
    expect(mutate).toHaveBeenCalledWith({ communityId: 'community-1' });
    expect(onDone).toHaveBeenCalledWith('Выдано банков: 3. Уведомлено участников: 2.');
  });

  it('hides the button after the backfill has already run', () => {
    render(
      <AdminBackfillCard
        communityId="community-1"
        alreadyRanAt="2026-08-27T12:00:00.000Z"
        emittedCount={12}
        onDone={vi.fn()}
        onError={vi.fn()}
      />,
    );
    expect(screen.getByText('Банки за прошлые дела уже выданы')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Выдать банки за прошлые дела' })).not.toBeInTheDocument();
  });
});
