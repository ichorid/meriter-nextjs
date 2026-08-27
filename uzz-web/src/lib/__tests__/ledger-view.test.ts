import { describe, expect, it } from 'vitest';
import { isLedgerStatusMarker, ledgerRowView, visibleLedgerRows, type LedgerRowInput } from '@/lib/ledger-view';

function row(overrides: Partial<LedgerRowInput> & Pick<LedgerRowInput, 'type'>): LedgerRowInput {
  return { amount: 0, metadata: {}, ...overrides };
}

describe('ledgerRowView', () => {
  it('builds a thanks_received line with counterparty, listing, and italic comment', () => {
    const view = ledgerRowView(row({
      type: 'thanks_received',
      amount: 3,
      metadata: { comment: 'Спасибо за урок' },
      context: { dealId: 'deal-1', counterpartyName: 'Айшат', listingTitle: 'Помощь с математикой' },
    }));
    expect(view).toMatchObject({
      title: 'Благодарность получена',
      subtitle: 'От Айшат — за услугу «Помощь с математикой»',
      comment: 'Спасибо за урок',
      amountText: '+3',
      unitText: 'заслуги',
      dealId: 'deal-1',
      statusMarker: false,
    });
  });

  it('appends the counterparty login as an anti-phishing anchor when known', () => {
    const view = ledgerRowView(row({
      type: 'thanks_received',
      amount: 3,
      context: { counterpartyName: 'Айшат', counterpartyUsername: 'oisha0417', listingTitle: 'Помощь с математикой' },
    }));
    expect(view.subtitle).toBe('От Айшат (@oisha0417) — за услугу «Помощь с математикой»');
  });

  it('builds a thanks_sent line the same way, addressing the recipient', () => {
    const view = ledgerRowView(row({
      type: 'thanks_sent',
      amount: -1,
      metadata: { comment: '  ' },
      context: { counterpartyName: 'Марина', listingTitle: 'Ремонт велосипеда' },
    }));
    expect(view.subtitle).toBe('Для Марина — за услугу «Ремонт велосипеда»');
    expect(view.comment).toBeUndefined();
    expect(view.amountText).toBe('-1');
    expect(view.unitText).toBe('заслуга');
  });

  it('omits missing thanks fields instead of leaving placeholders', () => {
    expect(ledgerRowView(row({
      type: 'thanks_received',
      amount: 1,
      context: { listingTitle: 'Репетиторство' },
    })).subtitle).toBe('за услугу «Репетиторство»');
    expect(ledgerRowView(row({
      type: 'thanks_sent',
      amount: -2,
      context: { counterpartyName: 'Олег' },
    })).subtitle).toBe('Для Олег');
    expect(ledgerRowView(row({ type: 'thanks_received', amount: 1 })).subtitle).toBeUndefined();
  });

  it('describes a right_emitted row with the publication title', () => {
    const view = ledgerRowView(row({
      type: 'right_emitted',
      amount: 0,
      context: { publicationId: 'pub-1', publicationTitle: 'Заслуга тест 1' },
    }));
    expect(view.title).toBe('Появился банк на обмен');
    expect(view.subtitle).toBe('За пост «Заслуга тест 1»');
    expect(view.amountText).toBeUndefined();
    expect(view.unitText).toBeUndefined();
    expect(view.statusMarker).toBe(false);
  });

  it('keeps a legacy row without context readable', () => {
    const view = ledgerRowView(row({ type: 'fee_reserved', amount: -1 }));
    expect(view).toEqual({
      title: 'Комиссия зарезервирована',
      subtitle: undefined,
      comment: undefined,
      amountText: '-1',
      unitText: 'заслуга',
      dealId: undefined,
      statusMarker: false,
    });
  });

  it('formats demurrage from/to when both metadata values are numbers', () => {
    const view = ledgerRowView(row({
      type: 'demurrage',
      amount: -10,
      metadata: { from: 500, to: 490 },
    }));
    expect(view.subtitle).toBe('Номинал 500 → 490 ₽');
    expect(view.unitText).toBe('₽ номинала');
    expect(ledgerRowView(row({
      type: 'demurrage',
      amount: -10,
      metadata: { from: 500 },
    })).subtitle).toBeUndefined();
  });

  it('keeps the fee refund reason and adds the listing when present', () => {
    expect(ledgerRowView(row({
      type: 'fee_refunded',
      amount: 1,
      metadata: { reason: 'expired' },
      context: { listingTitle: 'Помощь с математикой' },
    })).subtitle).toBe('Заявка истекла по сроку · Услуга «Помощь с математикой»');
    expect(ledgerRowView(row({
      type: 'fee_refunded',
      amount: 1,
      metadata: { reason: 'Договорились об отмене' },
    })).subtitle).toBe('Договорились об отмене');
  });

  it('describes bank transfer and fee reserve from context', () => {
    expect(ledgerRowView(row({
      type: 'right_received',
      amount: 400,
      context: { counterpartyName: 'Айшат', listingTitle: 'Помощь с математикой' },
    })).subtitle).toBe('Банк от Айшат — услуга «Помощь с математикой»');
    expect(ledgerRowView(row({
      type: 'right_sent',
      amount: -400,
      context: { counterpartyName: 'Олег', listingTitle: 'Ремонт' },
    })).subtitle).toBe('Банк передан Олег — услуга «Ремонт»');
    expect(ledgerRowView(row({
      type: 'fee_reserved',
      amount: -1,
      context: { listingTitle: 'Репетиторство' },
    })).subtitle).toBe('Заявка на услугу «Репетиторство»');
    expect(ledgerRowView(row({ type: 'nominal_assigned', amount: 500 })).subtitle).toBe('Номинал банка назначен');
  });

  it('marks zero-amount deal status events as markers', () => {
    for (const type of [
      'deal_requested',
      'deal_accepted',
      'deal_completed',
      'deal_closed',
      'deal_cancelled',
      'deal_rejected',
      'admin_resolution',
    ]) {
      const view = ledgerRowView(row({ type, amount: 0 }));
      expect(view.statusMarker).toBe(true);
      expect(isLedgerStatusMarker(type)).toBe(true);
      expect(view.amountText).toBeUndefined();
    }
    expect(isLedgerStatusMarker('right_emitted')).toBe(false);
    expect(isLedgerStatusMarker('fee_reserved')).toBe(false);
  });
});

describe('visibleLedgerRows', () => {
  it('hides status markers by default and always keeps right_emitted', () => {
    const items = [
      { id: 'a', type: 'fee_reserved' },
      { id: 'b', type: 'deal_closed' },
      { id: 'c', type: 'right_emitted' },
      { id: 'd', type: 'admin_resolution' },
    ];
    expect(visibleLedgerRows(items, false).map((item) => item.id)).toEqual(['a', 'c']);
    expect(visibleLedgerRows(items, true).map((item) => item.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});
