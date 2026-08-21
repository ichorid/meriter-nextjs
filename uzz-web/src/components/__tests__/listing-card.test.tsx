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

describe('ListingCard long content', () => {
  it('clamps a long description so one card cannot stretch a catalog row', () => {
    render(<ListingCard listing={{ ...listing, description: `Начало описания. ${'Очень '.repeat(400)}` }} own />);

    const description = screen.getByText(/^Начало описания\./);
    expect(description.className).toContain('line-clamp-4');
  });

  it('clamps the title and the availability line as well', () => {
    render(<ListingCard listing={{ ...listing, title: 'Заголовок '.repeat(30) }} own />);

    expect(screen.getByRole('heading', { level: 2 }).className).toContain('line-clamp-2');
    expect(screen.getByText(/^Когда:/).className).toContain('line-clamp-2');
  });
});
