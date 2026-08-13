import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ListingEditor } from '@/components/listing-editor';

describe('ListingEditor', () => {
  it('prefills and submits an edited listing', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ListingEditor initial={{ title: 'Консультация', description: 'Описание', priceRub: 500, deliveryMode: 'online', locationText: '', durationText: '1 час', availabilityText: 'вечером' }} pending={false} onCancel={vi.fn()} onSubmit={onSubmit} submitLabel="Сохранить изменения" />);

    expect(screen.getByLabelText('Название')).toHaveValue('Консультация');
    await user.click(screen.getByRole('button', { name: 'Сохранить изменения' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ title: 'Консультация', priceRub: 500 }));
  });

  it('shows inline errors for a blank title and fractional price', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ListingEditor pending={false} onCancel={vi.fn()} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Название'), '   ');
    await user.clear(screen.getByLabelText('Цена, ₽'));
    await user.type(screen.getByLabelText('Цена, ₽'), '10.5');
    await user.click(screen.getByRole('button', { name: 'Опубликовать' }));
    expect(screen.getByText('Название должно содержать не меньше 3 символов')).toBeVisible();
    expect(screen.getByText('Цена должна быть целым числом больше нуля')).toBeVisible();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
