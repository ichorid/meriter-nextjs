import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type FormEvent, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Dialog, DialogTitle } from '@/components/dialog';
import { DEAL_DEADLINE_NOT_FUTURE_MESSAGE } from '@/lib/local-datetime';

const { community, listingsState, requestMutate } = vi.hoisted(() => ({
  community: { communityId: 'community-1', loggedIn: true, sessionLoading: false, userId: 'buyer-1' },
  listingsState: {
    data: [{
      id: 'lot-1', authorId: 'seller-1', ownerName: 'Анна', title: 'Консультация',
      description: 'Помогу разобраться', priceRub: 500, deliveryMode: 'online' as const,
      locationText: '', durationText: '1 час', availabilityText: 'вечером', active: true,
    }],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  },
  requestMutate: vi.fn(),
}));

vi.mock('@/components/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/lib/use-uzz-community', () => ({
  useUzzCommunityId: () => community,
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
    community: {
      getPublic: { useQuery: () => ({ data: { id: 'community-1', name: 'Пилот' }, isLoading: false, isError: false, refetch: vi.fn() }) },
    },
    lots: {
      list: { useQuery: () => listingsState },
      canBuy: { useQuery: () => ({ data: { nudge: false }, isLoading: false, isError: false, error: null, refetch: vi.fn() }) },
    },
    banks: {
      listMine: { useQuery: () => ({ data: [{ id: 'right-1', status: 'active', nominalRub: 5000, hopsLeft: 10 }], isLoading: false, isError: false, refetch: vi.fn() }) },
    },
    wallet: {
      getBalance: { useQuery: () => ({ data: { canPayFee: true, localBalance: 1, globalBalance: 0 }, isLoading: false, isError: false }) },
    },
    settings: {
      get: { useQuery: () => ({ data: { demurrageRubPerDay: 100, nominalFloorRub: 100 }, isLoading: false }) },
    },
    identity: {
      getLinkStatus: { useQuery: () => ({ data: { linked: true }, isLoading: false, isError: false, refetch: vi.fn() }) },
    },
    deals: {
      request: {
        useMutation: (options?: { onError?: (err: { message?: string }) => void }) => ({
          isPending: false,
          mutate: (vars: unknown) => requestMutate(vars, options),
        }),
      },
    },
  },
}));

import CatalogPage from '@/app/catalog/page';

function Harness({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <>
      <button type="button">Открыть каталог</button>
      <Dialog open={open} onClose={onClose} labelledBy="dlg-title" describedBy="dlg-desc">
        <DialogTitle id="dlg-title">Запросить услугу «Консультация»</DialogTitle>
        <p id="dlg-desc">Цена 500 ₽. Комиссия 1 заслуга: кошелёк сообщества. Срок можно указать в форме.</p>
        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <select aria-label="Банк на обмен" defaultValue="right-1">
            <option value="right-1">до 5000 ₽</option>
          </select>
          <textarea aria-label="Сообщение исполнителю" />
          <button type="button" onClick={onClose}>Отмена</button>
          <button type="submit">Подтвердить заявку</button>
        </form>
      </Dialog>
    </>
  );
}

describe('Dialog', () => {
  it('exposes an accessible name from DialogTitle', () => {
    render(<Harness open onClose={vi.fn()} onSubmit={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Запросить услугу «Консультация»' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-describedby', 'dlg-desc');
    expect(document.getElementById('dlg-desc')).toHaveTextContent(/Цена 500/);
    expect(document.getElementById('dlg-desc')).toHaveTextContent(/Комиссия/);
    expect(document.getElementById('dlg-desc')).toHaveTextContent(/Срок/);
  });

  it('moves initial focus to the first enabled field', async () => {
    render(<Harness open onClose={vi.fn()} onSubmit={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText('Банк на обмен')).toHaveFocus());
  });

  it('wraps Tab and Shift+Tab inside the dialog', async () => {
    const user = userEvent.setup();
    render(<Harness open onClose={vi.fn()} onSubmit={vi.fn()} />);
    const select = screen.getByLabelText('Банк на обмен');
    const submit = screen.getByRole('button', { name: 'Подтвердить заявку' });
    await waitFor(() => expect(select).toHaveFocus());

    await user.tab();
    expect(screen.getByLabelText('Сообщение исполнителю')).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Отмена' })).toHaveFocus();
    await user.tab();
    expect(submit).toHaveFocus();
    await user.tab();
    expect(select).toHaveFocus();
    await user.tab({ shift: true });
    expect(submit).toHaveFocus();
  });

  it('closes on Escape without submitting the form', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSubmit = vi.fn();
    render(<Harness open onClose={onClose} onSubmit={onSubmit} />);
    await waitFor(() => expect(screen.getByLabelText('Банк на обмен')).toHaveFocus());
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not listen for Escape while closed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness open={false} onClose={onClose} onSubmit={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes when the backdrop is pressed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness open onClose={onClose} onSubmit={vi.fn()} />);
    await user.pointer({ keys: '[MouseLeft>]', target: screen.getByRole('dialog') });
    await user.pointer({ keys: '[/MouseLeft]' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('locks body scroll without shrinking layout width and restores on close', async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1000 });
    Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 984 });

    function ScrollCase() {
      const [open, setOpen] = useState(true);
      return <Harness open={open} onClose={() => setOpen(false)} onSubmit={vi.fn()} />;
    }

    render(<ScrollCase />);
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.body.style.paddingRight).toBe('16px');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(document.body.style.overflow).toBe(''));
    expect(document.body.style.paddingRight).toBe('');
  });

  it('returns focus to the previously focused control', async () => {
    const user = userEvent.setup();
    function ReturnCase() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Оставить заявку</button>
          <Harness open={open} onClose={() => setOpen(false)} onSubmit={vi.fn()} />
        </>
      );
    }
    render(<ReturnCase />);
    const opener = screen.getByRole('button', { name: 'Оставить заявку' });
    await user.click(opener);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    await user.keyboard('{Escape}');
    await waitFor(() => expect(opener).toHaveFocus());
  });
});

describe('CatalogPage request dialog', () => {
  beforeEach(() => {
    requestMutate.mockReset();
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
  });

  it('names the dialog after the listing and describes price, fee and deadline', async () => {
    const user = userEvent.setup();
    render(<CatalogPage />);
    await user.click(screen.getByRole('button', { name: 'Оставить заявку' }));

    const dialog = await screen.findByRole('dialog', { name: 'Запросить услугу «Консультация»' });
    const describedBy = dialog.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const description = describedBy?.split(' ').map((id) => document.getElementById(id)?.textContent ?? '').join(' ') ?? '';
    expect(description).toMatch(/500/);
    expect(description).toMatch(/комиссия/i);
    expect(description).toMatch(/срок/i);
  });

  it('returns focus to the listing request button and does not submit on Escape', async () => {
    const user = userEvent.setup();
    render(<CatalogPage />);
    const opener = screen.getByRole('button', { name: 'Оставить заявку' });
    await user.click(opener);
    await screen.findByRole('dialog', { name: 'Запросить услугу «Консультация»' });
    await user.keyboard('{Escape}');
    await waitFor(() => expect(opener).toHaveFocus());
    expect(requestMutate).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps DEAL_DEADLINE_NOT_FUTURE specific instead of generic', async () => {
    const user = userEvent.setup();
    requestMutate.mockImplementation((_vars: unknown, options?: { onError?: (err: { message?: string }) => void }) => {
      options?.onError?.({ message: 'DEAL_DEADLINE_NOT_FUTURE' });
    });
    render(<CatalogPage />);
    await user.click(screen.getByRole('button', { name: 'Оставить заявку' }));
    await user.type(screen.getByLabelText(/^Сообщение исполнителю/), 'Нужна помощь');
    await user.click(screen.getByRole('button', { name: 'Подтвердить заявку' }));
    expect(screen.getByRole('status')).toHaveTextContent(DEAL_DEADLINE_NOT_FUTURE_MESSAGE);
  });
});
