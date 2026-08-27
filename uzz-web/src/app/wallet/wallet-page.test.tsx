import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type LedgerCursor = { createdAt: string; id: string };

const { community, balanceState, ledgerQuery, defaultPages } = vi.hoisted(() => {
  const page1 = {
    items: Array.from({ length: 30 }, (_, index) => ({
      id: `a-${String(index).padStart(2, '0')}`,
      type: 'fee_reserved',
      amount: -1,
      createdAt: '2026-08-14T12:00:00.000Z',
      metadata: {},
    })),
    nextCursor: { createdAt: '2026-08-14T12:00:00.000Z', id: 'a-29' } as LedgerCursor | null,
  };
  const page2 = {
    items: Array.from({ length: 5 }, (_, index) => ({
      id: `b-${String(index).padStart(2, '0')}`,
      type: 'fee_refunded',
      amount: 1,
      createdAt: '2026-08-13T12:00:00.000Z',
      metadata: {},
    })),
    nextCursor: null as LedgerCursor | null,
  };
  return {
    community: { communityId: 'community-1', loggedIn: true },
    balanceState: {
      data: {
        localBalance: 5,
        globalBalance: 3,
        totalBalance: 8,
        mode: 'split' as 'split' | 'shared',
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    },
    defaultPages: { page1, page2 },
    ledgerQuery: {
      cursor: undefined as LedgerCursor | undefined,
      page1: { ...page1, items: [...page1.items] },
      page2: { ...page2, items: [...page2.items] },
    },
  };
});

vi.mock('@/components/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/lib/use-uzz-community', () => ({
  useUzzCommunityId: () => community,
}));

vi.mock('@/lib/trpc/client', () => ({
  trpc: {
    wallet: {
      getBalance: { useQuery: () => balanceState },
    },
    ledger: {
      listMine: {
        useQuery: (input: { cursor?: LedgerCursor }) => {
          ledgerQuery.cursor = input.cursor;
          const data = input.cursor ? ledgerQuery.page2 : ledgerQuery.page1;
          return { data, isLoading: false, isError: false, refetch: vi.fn() };
        },
      },
    },
  },
}));

import WalletPage from './page';

describe('WalletPage', () => {
  beforeEach(() => {
    ledgerQuery.cursor = undefined;
    ledgerQuery.page1 = { ...defaultPages.page1, items: [...defaultPages.page1.items] };
    ledgerQuery.page2 = { ...defaultPages.page2, items: [...defaultPages.page2.items] };
    balanceState.data = {
      localBalance: 5,
      globalBalance: 3,
      totalBalance: 8,
      mode: 'split',
    };
  });

  it('appends the next ledger page and announces the new count', async () => {
    const user = userEvent.setup();
    render(<WalletPage />);

    expect(screen.getByText('Показаны последние 30 операций')).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Показаны последние 30 операций');
    expect(screen.getAllByRole('listitem')).toHaveLength(30);

    await user.click(screen.getByRole('button', { name: 'Показать ещё' }));

    expect(ledgerQuery.cursor).toEqual(ledgerQuery.page1.nextCursor);
    expect(screen.getByText('Показаны последние 35 операций')).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Показаны последние 35 операций');
    expect(screen.getAllByRole('listitem')).toHaveLength(35);
    expect(screen.queryByRole('button', { name: 'Показать ещё' })).not.toBeInTheDocument();
  });

  it('renders one community balance card in shared mode and no global card', () => {
    balanceState.data = {
      localBalance: 5,
      globalBalance: 0,
      totalBalance: 12,
      mode: 'shared',
    };
    render(<WalletPage />);

    expect(screen.getByText('Баланс сообщества')).toBeVisible();
    expect(screen.getByText('12')).toBeVisible();
    expect(screen.queryByText('Общий кошелёк')).not.toBeInTheDocument();
    expect(screen.queryByText('В этом сообществе')).not.toBeInTheDocument();
    expect(screen.queryByText('5')).not.toBeInTheDocument();
  });

  it('hides zero-amount status events until the user asks to see them', async () => {
    const user = userEvent.setup();
    ledgerQuery.page1 = {
      items: [
        { id: 'fee-1', type: 'fee_reserved', amount: -1, createdAt: '2026-08-14T12:00:00.000Z', metadata: {}, context: { dealId: 'deal-1', listingTitle: 'Репетиторство' } },
        { id: 'closed-1', type: 'deal_closed', amount: 0, createdAt: '2026-08-14T11:00:00.000Z', metadata: {} },
        { id: 'emit-1', type: 'right_emitted', amount: 0, createdAt: '2026-08-14T10:00:00.000Z', metadata: {}, context: { publicationTitle: 'Заслуга тест 1' } },
      ],
      nextCursor: null,
    };
    render(<WalletPage />);

    expect(screen.getByText('Комиссия зарезервирована')).toBeVisible();
    expect(screen.getByText('Заявка на услугу «Репетиторство»')).toBeVisible();
    expect(screen.getByRole('link', { name: 'К сделке →' })).toHaveAttribute('href', '/deals?deal=deal-1');
    expect(screen.getByText('Появился банк на обмен')).toBeVisible();
    expect(screen.getByText('За пост «Заслуга тест 1»')).toBeVisible();
    expect(screen.queryByText('Сделка закрыта')).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);

    await user.click(screen.getByRole('checkbox', { name: 'Показать все события' }));
    expect(screen.getByText('Сделка закрыта')).toBeVisible();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('renders thanks context, comment, and merit unit', () => {
    ledgerQuery.page1 = {
      items: [{
        id: 'thanks-1',
        type: 'thanks_received',
        amount: 3,
        createdAt: '2026-08-14T12:00:00.000Z',
        metadata: { comment: 'Спасибо за урок' },
        context: { dealId: 'deal-9', counterpartyName: 'Айшат', listingTitle: 'Помощь с математикой' },
      }],
      nextCursor: null,
    };
    render(<WalletPage />);

    expect(screen.getByText('Благодарность получена')).toBeVisible();
    expect(screen.getByText('От Айшат — за услугу «Помощь с математикой»')).toBeVisible();
    expect(screen.getByText('Спасибо за урок')).toBeVisible();
    expect(screen.getByText('+3')).toBeVisible();
    expect(screen.getByRole('listitem')).toHaveTextContent('заслуги');
  });
});
