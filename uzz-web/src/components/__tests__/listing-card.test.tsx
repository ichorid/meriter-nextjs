import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ListingCard, type ListingView } from '@/components/listing-card';

const listing: ListingView = {
  id: 'listing-1', authorId: 'seller-1', ownerName: 'Анна', title: 'Консультация',
  description: 'Помогу разобраться', priceRub: 500, deliveryMode: 'online',
  locationText: '', durationText: '1 час', availabilityText: 'вечером', active: true,
};

describe('ListingCard request action', () => {
  it('shows a supplied prerequisite instead of claiming the nominal is insufficient', () => {
    render(<ListingCard listing={listing} requestLabel="Сначала привяжите Telegram" requestDisabled={false} onRequest={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Сначала привяжите Telegram' })).toBeEnabled();
    expect(screen.queryByText('Нужен больший номинал')).not.toBeInTheDocument();
  });

  it('disables the request action while prerequisites are loading', () => {
    render(<ListingCard listing={listing} requestLabel="Проверяем ваши права…" requestDisabled onRequest={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Проверяем ваши права…' })).toBeDisabled();
  });
});
