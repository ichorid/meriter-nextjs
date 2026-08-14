import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type LedgerCursor = { createdAt: string; id: string };

const { community, balanceState, ledgerQuery } = vi.hoisted(() => ({
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
  ledgerQuery: {
    cursor: undefined as LedgerCursor | undefined,
    page1: {
      items: Array.from({ length: 30 }, (_, index) => ({
        id: `a-${String(index).padStart(2, '0')}`,
        type: 'fee_reserved',
        amount: -1,
        createdAt: '2026-08-14T12:00:00.000Z',
        metadata: {},
      })),
      nextCursor: { createdAt: '2026-08-14T12:00:00.000Z', id: 'a-29' },
    },
    page2: {
      items: Array.from({ length: 5 }, (_, index) => ({
        id: `b-${String(index).padStart(2, '0')}`,
        type: 'fee_refunded',
        amount: 1,
        createdAt: '2026-08-13T12:00:00.000Z',
        metadata: {},
      })),
      nextCursor: null as LedgerCursor | null,
    },
  },
}));

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
});
