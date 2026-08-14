import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/admin-settings-form', () => ({
  AdminSettingsForm: () => <div>Настройки формы</div>,
}));

vi.mock('@/lib/use-uzz-community', () => ({
  useUzzCommunityId: () => ({ communityId: 'community-1', isUzzAdmin: true, loggedIn: true }),
}));

vi.mock('@/lib/trpc/client', () => {
  const emptyLedger = { items: [] as const, nextCursor: null };
  return {
  trpc: {
    useUtils: () => ({
      settings: { get: { invalidate: vi.fn() } },
      banks: { listAwaitingNominal: { invalidate: vi.fn() } },
      deals: { adminList: { invalidate: vi.fn() } },
      ledger: { list: { invalidate: vi.fn() } },
    }),
    settings: {
      get: { useQuery: () => ({ data: { demurrageRubPerDay: 100, nominalFloorRub: 100 }, isLoading: false, isError: false }) },
      update: { useMutation: () => ({ isPending: false, mutate: vi.fn(), error: null }) },
    },
    banks: {
      listAwaitingNominal: { useQuery: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }) },
      listHolding: { useQuery: () => ({ data: [], isLoading: false, isError: false }) },
      setNominal: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
    },
    deals: {
      adminList: { useQuery: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }) },
      adminClose: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
      adminCancel: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
    },
    ledger: {
      list: {
        useQuery: () => ({
          data: emptyLedger,
          isLoading: false,
          isError: false,
          refetch: vi.fn(),
        }),
      },
    },
  },
  };
});

import AdminPage from './page';

describe('AdminPage ledger', () => {
  it('shows an empty state when the journal has no operations', () => {
    render(<AdminPage />);

    expect(screen.getByText('Операций пока нет')).toBeVisible();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
