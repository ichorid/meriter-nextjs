import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DealCard, type DealView } from '@/components/deal-card';

const deal: DealView = { id: 'deal-1', status: 'requested', myRole: 'buyer', listingSnapshot: { title: 'Консультация', priceRub: 500, deliveryMode: 'online', locationText: 'Telegram' }, requestMessage: 'Нужна помощь', currentNominalRub: 600, sellerContact: { telegramUsername: 'seller' } };

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
});
