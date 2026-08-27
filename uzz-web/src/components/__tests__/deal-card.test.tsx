import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DealAcceptForm } from '@/components/deal-accept-form';
import { DealCard, type DealView } from '@/components/deal-card';
import { formatDeadlineLabel } from '@/lib/local-datetime';

const deal: DealView = { id: 'deal-1', status: 'requested', myRole: 'buyer', listingSnapshot: { title: 'Консультация', priceRub: 500, deliveryMode: 'online', locationText: 'Telegram' }, requestMessage: 'Нужна помощь', currentNominalRub: 600, sellerContact: { telegramUsername: 'seller' } };

const requestedDeadlineAt = '2026-08-20T11:00:00.000Z';
const agreedDeadlineAt = '2026-08-21T15:30:00.000Z';

describe('DealCard', () => {
  it('hides Telegram contact before accept and shows it after accept', () => {
    const { rerender } = render(<DealCard deal={deal} />);
    expect(screen.queryByRole('link', { name: /Написать @seller/ })).not.toBeInTheDocument();
    rerender(<DealCard deal={{ ...deal, status: 'accepted', acceptedNominalRub: 600 }} />);
    expect(screen.getByRole('link', { name: 'Написать @seller' })).toHaveAttribute('href', 'https://t.me/seller');
  });

  it('shows the closing nominal and actual fee source on a closed deal', () => {
    render(<DealCard deal={{ ...deal, status: 'closed', communityId: 'community-1', feeSourceCommunityId: '__global__', feeReserved: true, acceptedNominalRub: 600, dealAmountRub: 400 }} />);
    expect(screen.getByText('400 ₽')).toBeVisible();
    expect(screen.queryByText('600 ₽')).not.toBeInTheDocument();
    expect(screen.getByText('Списана 1 заслуга с общего кошелька')).toBeVisible();
  });

  it('shows listing price, current nominal, signed difference, demurrage, message and both deadlines in the acceptance view', () => {
    render(
      <DealCard deal={{ ...deal, myRole: 'seller', requestedDeadlineAt, agreedDeadlineAt }}>
        <DealAcceptForm
          listingPriceRub={500}
          currentNominalRub={600}
          demurrageRubPerDay={75}
          requestMessage="Нужна помощь"
          requestedDeadlineAt={requestedDeadlineAt}
          agreedDeadlineAt={agreedDeadlineAt}
          pending={false}
          onCancel={vi.fn()}
          onAccept={vi.fn()}
        />
      </DealCard>,
    );

    expect(screen.getAllByText('500 ₽').length).toBeGreaterThan(0);
    expect(screen.getAllByText('600 ₽').length).toBeGreaterThan(0);
    expect(screen.getByText('+100 ₽')).toBeVisible();
    expect(screen.getByText('75 ₽ в день')).toBeVisible();
    expect(screen.getAllByText('Нужна помощь').length).toBeGreaterThan(0);
    expect(screen.getAllByText(formatDeadlineLabel(requestedDeadlineAt)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(formatDeadlineLabel(agreedDeadlineAt)).length).toBeGreaterThan(0);
  });

  it('warns when nominal is below listing price without blocking acceptance', () => {
    render(
      <DealAcceptForm
        listingPriceRub={500}
        currentNominalRub={400}
        demurrageRubPerDay={75}
        requestMessage="Нужна помощь"
        pending={false}
        onCancel={vi.fn()}
        onAccept={vi.fn()}
      />,
    );

    expect(screen.getByText('−100 ₽')).toBeVisible();
    expect(screen.getByText(/номинал ниже цены/i)).toBeVisible();
    expect(screen.getByRole('button', { name: /Принять на 400 ₽/ })).toBeEnabled();
  });
});
