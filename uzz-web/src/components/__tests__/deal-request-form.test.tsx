import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DealRequestForm } from '@/components/deal-request-form';

const right = { id: 'right-1', nominalRub: 5000, status: 'active', hopsLeft: 10 };

const catalogState = vi.hoisted(() => ({
  community: { communityId: 'community-1', loggedIn: true, sessionLoading: false, userId: 'buyer-1' },
  listings: {
    data: [{
      id: 'lot-1', authorId: 'seller-1', ownerName: 'Анна', title: 'Консультация',
      description: 'Помогу разобраться', priceRub: 500, deliveryMode: 'online' as const,
      locationText: '', durationText: '1 час', availabilityText: 'вечером', active: true,
    }],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  },
  settings: { data: undefined as { demurrageRubPerDay: number; nominalFloorRub: number } | undefined, isLoading: true, isError: false, refetch: vi.fn() },
  wallet: { data: undefined as { canPayFee: boolean; localBalance: number; globalBalance: number } | undefined, isLoading: true, isError: false, refetch: vi.fn() },
}));

vi.mock('@/components/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/lib/use-uzz-community', () => ({
  useUzzCommunityId: () => catalogState.community,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('@/lib/trpc/client', () => ({
  trpc: {
    useUtils: () => ({
      deals: { list: { invalidate: vi.fn() } },
      banks: { listMine: { invalidate: vi.fn() } },
      wallet: { getBalance: { invalidate: vi.fn() } },
    }),
    lots: {
      list: { useQuery: () => catalogState.listings },
      canBuy: { useQuery: () => ({ data: { nudge: false }, isLoading: false, isError: false, error: null, refetch: vi.fn() }) },
    },
    banks: {
      listMine: { useQuery: () => ({ data: [{ id: 'right-1', status: 'active', nominalRub: 5000, hopsLeft: 10 }], isLoading: false, isError: false, refetch: vi.fn() }) },
    },
    wallet: {
      getBalance: { useQuery: () => catalogState.wallet },
    },
    settings: {
      get: { useQuery: () => catalogState.settings },
    },
    identity: {
      getLinkStatus: { useQuery: () => ({ data: { linked: true }, isLoading: false, isError: false, refetch: vi.fn() }) },
    },
    deals: {
      request: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
    },
  },
}));

import CatalogPage from '@/app/catalog/page';

describe('DealRequestForm', () => {
  it('does not submit without a request message', async () => {
    const onSubmit = vi.fn();
    render(<DealRequestForm title="Консультация" priceRub={500} rights={[right]} pending={false} onCancel={vi.fn()} onSubmit={onSubmit} />);

    expect(screen.getByRole('button', { name: 'Подтвердить заявку' })).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows nominal forecast and fee source before confirmation', () => {
    render(<DealRequestForm title="Консультация" priceRub={500} rights={[right]} pending={false} demurrageRubPerDay={100} nominalFloorRub={100} feeSourceLabel="кошелёк сообщества" onCancel={vi.fn()} onSubmit={vi.fn()} />);

    expect(screen.getByText('Сегодня право: до 5 000 ₽')).toBeVisible();
    expect(screen.getByText('Завтра: до 4 900 ₽')).toBeVisible();
    expect(screen.getByText(/Комиссия 1 заслуга: кошелёк сообщества/)).toBeVisible();
  });

  it('submits a trimmed message and optional deadline', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<DealRequestForm title="Консультация" priceRub={500} rights={[right]} pending={false} onCancel={vi.fn()} onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText(/^Сообщение исполнителю/), '  Нужна помощь  ');
    await user.click(screen.getByRole('button', { name: 'Подтвердить заявку' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ bankId: 'right-1', requestMessage: 'Нужна помощь' }));
  });

  it('does not forecast tomorrow from hard-coded 100/100 fallbacks when settings are missing', () => {
    render(<DealRequestForm title="Консультация" priceRub={500} rights={[right]} pending={false} onCancel={vi.fn()} onSubmit={vi.fn()} />);

    expect(screen.queryByText('Завтра: до 4 900 ₽')).not.toBeInTheDocument();
    expect(screen.getByText('Загружаем условия…')).toBeVisible();
  });
});

describe('CatalogPage request gating', () => {
  beforeEach(() => {
    catalogState.community.loggedIn = true;
    catalogState.community.sessionLoading = false;
    catalogState.settings = { data: undefined, isLoading: true, isError: false, refetch: vi.fn() };
    catalogState.wallet = { data: undefined, isLoading: true, isError: false, refetch: vi.fn() };
  });

  it('disables the request button with skeleton copy until settings and fee source load', () => {
    render(<CatalogPage />);

    const button = screen.getByRole('button', { name: 'Загружаем условия…' });
    expect(button).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Оставить заявку' })).not.toBeInTheDocument();
  });

  it('keeps the request disabled when only the fee source has loaded', () => {
    catalogState.wallet = { data: { canPayFee: true, localBalance: 1, globalBalance: 0 }, isLoading: false, isError: false, refetch: vi.fn() };
    render(<CatalogPage />);

    expect(screen.getByRole('button', { name: 'Загружаем условия…' })).toBeDisabled();
  });

  it('enables the request after settings and fee source are loaded', () => {
    catalogState.settings = { data: { demurrageRubPerDay: 50, nominalFloorRub: 50 }, isLoading: false, isError: false, refetch: vi.fn() };
    catalogState.wallet = { data: { canPayFee: true, localBalance: 1, globalBalance: 0 }, isLoading: false, isError: false, refetch: vi.fn() };
    render(<CatalogPage />);

    expect(screen.getByRole('button', { name: 'Оставить заявку' })).toBeEnabled();
  });
});
