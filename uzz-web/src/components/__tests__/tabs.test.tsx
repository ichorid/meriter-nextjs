import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Tab, TabPanel, Tabs } from '@/components/tabs';

const { replace, searchParams } = vi.hoisted(() => ({
  replace: vi.fn(),
  searchParams: { get: (key: string) => new URLSearchParams(window.location.search).get(key) },
}));

vi.mock('@/components/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/lib/use-uzz-community', () => ({
  useUzzCommunityId: () => ({ communityId: 'community-1', loggedIn: true, sessionLoading: false }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => searchParams,
}));

vi.mock('@/lib/trpc/client', () => ({
  trpc: {
    useUtils: () => ({
      lots: { myLots: { invalidate: vi.fn() }, list: { invalidate: vi.fn() }, canBuy: { invalidate: vi.fn() } },
    }),
    banks: { listMine: { useQuery: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }) } },
    settings: { get: { useQuery: () => ({ data: { demurrageRubPerDay: 100, nominalFloorRub: 100 } }) } },
    lots: {
      myLots: { useQuery: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }) },
      create: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
      update: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
    },
    deeds: { list: { useQuery: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }) } },
  },
}));

import HomePage from '@/app/page';

function TabsHarness() {
  const [value, setValue] = useState('rights');
  return (
    <Tabs value={value} onChange={setValue} aria-label="Личный раздел">
      <Tab value="rights">Банки</Tab>
      <Tab value="listings">Мои услуги</Tab>
      <Tab value="deeds">Добрые дела</Tab>
      <TabPanel value="rights"><p>Банки панель</p></TabPanel>
      <TabPanel value="listings"><p>Услуги панель</p></TabPanel>
      <TabPanel value="deeds"><p>Дела панель</p></TabPanel>
    </Tabs>
  );
}

describe('Tabs', () => {
  it('uses roving tabIndex, aria-selected and aria-controls with stable ids', () => {
    const { rerender } = render(<TabsHarness />);
    const tabs = screen.getAllByRole('tab');
    const selected = screen.getByRole('tab', { selected: true });
    const panel = screen.getByRole('tabpanel');

    expect(tabs).toHaveLength(3);
    expect(selected).toHaveAccessibleName('Банки');
    expect(selected).toHaveAttribute('tabIndex', '0');
    expect(selected).toHaveAttribute('aria-selected', 'true');
    expect(selected).toHaveAttribute('aria-controls', panel.id);
    expect(panel).toHaveAttribute('aria-labelledby', selected.id);
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
    expect(panel).toHaveTextContent('Банки панель');

    for (const tab of tabs) {
      if (tab !== selected) {
        expect(tab).toHaveAttribute('tabIndex', '-1');
        expect(tab).toHaveAttribute('aria-selected', 'false');
        expect(tab.getAttribute('aria-controls')).toBeTruthy();
      }
      expect(tab.className).toMatch(/min-h-11/);
    }

    const ids = tabs.map((tab) => tab.id);
    rerender(<TabsHarness />);
    expect(screen.getAllByRole('tab').map((tab) => tab.id)).toEqual(ids);
  });

  it('moves selection with ArrowLeft/Right and Home/End', async () => {
    const user = userEvent.setup();
    render(<TabsHarness />);
    const rights = screen.getByRole('tab', { name: 'Банки' });
    rights.focus();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Мои услуги' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Мои услуги' })).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Услуги панель');
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Добрые дела' })).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Банки' })).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Добрые дела' })).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'Банки' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Банки' })).toHaveFocus();

    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Добрые дела' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Добрые дела' })).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Дела панель');
  });
});

describe('HomePage tabs', () => {
  beforeEach(() => {
    replace.mockReset();
    window.history.replaceState({}, '', '/');
  });

  it('keeps URL in sync when tabs change by click and keyboard', async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    const listings = screen.getByRole('tab', { name: 'Мои услуги' });
    expect(screen.getByRole('tab', { name: 'Банки' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);

    await user.click(listings);
    expect(replace).toHaveBeenCalledWith('/?tab=lots', { scroll: false });
    expect(listings).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Ваши услуги' })).toBeVisible();
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);

    screen.getByRole('tab', { name: 'Мои услуги' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(replace).toHaveBeenCalledWith('/?tab=deeds', { scroll: false });
    expect(screen.getByRole('tab', { name: 'Добрые дела' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Добрые дела' })).toHaveAttribute('aria-controls', screen.getByRole('tabpanel').id);

    await user.keyboard('{Home}');
    expect(replace).toHaveBeenCalledWith('/', { scroll: false });
    expect(screen.getByRole('tab', { name: 'Банки' })).toHaveAttribute('aria-selected', 'true');
  });
});
