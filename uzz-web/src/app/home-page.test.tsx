import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { community, createHandlers, settingsState, rightsState, myLotsState } = vi.hoisted(() => ({
  community: { communityId: 'community-1', loggedIn: true, sessionLoading: false },
  createHandlers: {
    onError: undefined as ((err: { message?: string }) => void) | undefined,
  },
  settingsState: {
    data: undefined as { demurrageRubPerDay: number; nominalFloorRub: number } | undefined,
    isLoading: true,
  },
  rightsState: {
    data: [] as Array<{ id: string; sourceTitle: string; status: string; hopsLeft: number; nominalRub: number | null }>,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  },
  myLotsState: {
    data: [] as Array<Record<string, unknown>>,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  },
}));

vi.mock('@/components/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/lib/use-uzz-community', () => ({
  useUzzCommunityId: () => community,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

vi.mock('@/lib/trpc/client', () => ({
  trpc: {
    useUtils: () => ({
      lots: { myLots: { invalidate: vi.fn() }, list: { invalidate: vi.fn() }, canBuy: { invalidate: vi.fn() } },
    }),
    banks: { listMine: { useQuery: () => rightsState } },
    settings: { get: { useQuery: () => settingsState } },
    lots: {
      myLots: { useQuery: () => myLotsState },
      create: {
        useMutation: (options?: { onError?: (err: { message?: string }) => void }) => {
          createHandlers.onError = options?.onError;
          return {
            isPending: false,
            mutate: () => createHandlers.onError?.({ message: 'LISTING_TITLE_INVALID' }),
          };
        },
      },
      update: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
    },
    deeds: { list: { useQuery: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }) } },
  },
}));

import HomePage from './page';

describe('HomePage listings and forecast', () => {
  beforeEach(() => {
    createHandlers.onError = undefined;
    settingsState.data = undefined;
    settingsState.isLoading = true;
    rightsState.data = [];
    myLotsState.data = [];
    window.history.replaceState({}, '', '/?tab=lots');
  });

  it('shows a listing create failure as an alert and clears it after close/reopen', async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    await user.click(screen.getByRole('tab', { name: 'Мои услуги' }));
    await user.click(screen.getByRole('button', { name: 'Добавить услугу' }));
    await user.type(screen.getByLabelText('Название'), 'Помощь с отчётом');
    await user.click(screen.getByRole('button', { name: 'Опубликовать' }));

    const alert = screen.getByRole('alert');
    expect(alert).toBeVisible();
    expect(alert).toHaveTextContent('Название должно содержать от 3 до 120 символов');

    await user.click(screen.getByRole('button', { name: 'Закрыть форму' }));
    await user.click(screen.getByRole('button', { name: 'Добавить услугу' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('Название должно содержать от 3 до 120 символов')).not.toBeInTheDocument();
  });

  it('lets each listing card keep its own height so the action buttons stay reachable', async () => {
    const user = userEvent.setup();
    myLotsState.data = [
      { id: 'lot-1', authorId: 'me', title: 'Короткая', description: 'Кратко', priceRub: 100, deliveryMode: 'online', locationText: '', durationText: '', availabilityText: '', active: true },
      { id: 'lot-2', authorId: 'me', title: 'Длинная', description: 'Очень '.repeat(200), priceRub: 200, deliveryMode: 'online', locationText: '', durationText: '', availabilityText: '', active: true },
    ];
    render(<HomePage />);

    await user.click(screen.getByRole('tab', { name: 'Мои услуги' }));

    // Without items-start the grid stretches every row to its tallest cell and the
    // buttons rendered under a short card slide beneath the next row.
    const grid = screen.getAllByRole('list').find((node) => node.className.includes('md:grid-cols-2'));
    expect(grid?.className).toContain('items-start');
    for (const item of grid?.querySelectorAll(':scope > li') ?? []) {
      expect(item.className).toContain('flex-col');
    }
    expect(screen.getAllByRole('button', { name: 'Редактировать' })).toHaveLength(2);
  });

  it('does not forecast tomorrow nominal from hard-coded 100/100 while settings load', () => {
    rightsState.data = [{
      id: 'right-1',
      sourceTitle: 'Субботник',
      status: 'active',
      hopsLeft: 8,
      nominalRub: 5000,
    }];
    window.history.replaceState({}, '', '/');
    render(<HomePage />);

    expect(screen.queryByText('4900 ₽')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeVisible();
  });
});
