import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DealView } from '@/components/deal-card';

const { community, dealsState, mutationHandlers, replace } = vi.hoisted(() => ({
  community: { communityId: 'community-1', loggedIn: true },
  dealsState: { data: [] as DealView[], isLoading: false, isError: false, refetch: vi.fn() },
  mutationHandlers: {
    accept: undefined as ((err: { message?: string }, vars: { dealId: string }) => void) | undefined,
    complete: undefined as ((err: { message?: string }, vars: { dealId: string }) => void) | undefined,
  },
  replace: vi.fn(),
}));

vi.mock('@/components/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/lib/use-uzz-community', () => ({
  useUzzCommunityId: () => community,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

function mutationStub(kind: 'accept' | 'complete') {
  return (options?: { onError?: (err: { message?: string }, vars: { dealId: string }) => void }) => {
    mutationHandlers[kind] = options?.onError;
    return {
      isPending: false,
      mutate: (vars: { dealId: string }) => {
        mutationHandlers[kind]?.({ message: kind === 'complete' ? 'FORBIDDEN' : 'DEAL_DEADLINE_NOT_FUTURE' }, vars);
      },
    };
  };
}

vi.mock('@/lib/trpc/client', () => ({
  trpc: {
    useUtils: () => ({
      deals: { list: { invalidate: vi.fn() } },
      banks: { listMine: { invalidate: vi.fn() } },
      wallet: { getBalance: { invalidate: vi.fn() } },
    }),
    deals: {
      list: { useQuery: () => dealsState },
      accept: { useMutation: mutationStub('accept') },
      reject: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
      cancel: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
      complete: { useMutation: mutationStub('complete') },
      close: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
      thank: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
    },
    settings: {
      get: { useQuery: () => ({ data: { demurrageRubPerDay: 100, nominalFloorRub: 100 }, isLoading: false }) },
    },
  },
}));

import { DEAL_DEADLINE_NOT_FUTURE_MESSAGE } from '@/lib/local-datetime';
import DealsPage from './page';

const acceptedSeller: DealView = {
  id: 'deal-complete',
  status: 'accepted',
  myRole: 'seller',
  listingSnapshot: { title: 'Консультация', priceRub: 500, deliveryMode: 'online', locationText: 'Telegram' },
  requestMessage: 'Нужна помощь',
  currentNominalRub: 600,
};

const requestedSeller: DealView = {
  id: 'deal-accept',
  status: 'requested',
  myRole: 'seller',
  listingSnapshot: { title: 'Ремонт', priceRub: 800, deliveryMode: 'offline', locationText: 'Дом' },
  requestMessage: 'Можно завтра?',
  currentNominalRub: 900,
  requestedDeadlineAt: '2026-08-20T11:00:00.000Z',
};

describe('DealsPage action errors', () => {
  beforeEach(() => {
    dealsState.data = [acceptedSeller];
    dealsState.isLoading = false;
    dealsState.isError = false;
    mutationHandlers.accept = undefined;
    mutationHandlers.complete = undefined;
    replace.mockReset();
    window.history.replaceState({}, '', '/deals');
  });

  it('surfaces a complete failure in a page-level live region without a detail panel', async () => {
    const user = userEvent.setup();
    render(<DealsPage />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Услуга выполнена' }));

    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
    expect(alert).toHaveTextContent('Для этого действия недостаточно прав');
    expect(screen.queryByRole('button', { name: 'Назад' })).not.toBeInTheDocument();

    const list = screen.getByRole('list', { name: 'Сделки' });
    expect(alert.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps the error until dismiss and retains the accept panel after a failed mutation', async () => {
    const user = userEvent.setup();
    dealsState.data = [requestedSeller];
    render(<DealsPage />);

    await user.click(screen.getByRole('button', { name: 'Рассмотреть и принять' }));
    await user.click(screen.getByRole('button', { name: /Принять на 900 ₽/ }));

    expect(screen.getByRole('alert')).toHaveTextContent(DEAL_DEADLINE_NOT_FUTURE_MESSAGE);
    expect(screen.getByRole('button', { name: 'Назад' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Скрыть' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Назад' })).toBeVisible();
  });
});

describe('DealsPage flash', () => {
  beforeEach(() => {
    dealsState.data = [];
    dealsState.isLoading = false;
    dealsState.isError = false;
    replace.mockReset();
  });

  it('does not render success copy from an arbitrary requested value', () => {
    window.history.replaceState({}, '', '/deals?requested=evil');
    render(<DealsPage />);

    expect(screen.queryByText(/Заявка отправлена/)).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('shows an allowlisted request flash once and removes the query', async () => {
    window.history.replaceState({}, '', '/deals?requested=1&feeSource=local');
    render(<DealsPage />);

    expect(screen.getByText('Заявка отправлена. Зарезервирована 1 заслуга с кошелька сообщества.')).toBeVisible();
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/deals', { scroll: false });
    });
  });
});
