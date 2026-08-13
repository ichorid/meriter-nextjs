import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DealRequestForm } from '@/components/deal-request-form';

const right = { id: 'right-1', nominalRub: 5000, status: 'active', hopsLeft: 10 };

describe('DealRequestForm', () => {
  it('does not submit without a request message', async () => {
    const onSubmit = vi.fn();
    render(<DealRequestForm title="Консультация" priceRub={500} rights={[right]} pending={false} onCancel={vi.fn()} onSubmit={onSubmit} />);

    expect(screen.getByRole('button', { name: 'Подтвердить заявку' })).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows nominal forecast and fee source before confirmation', () => {
    render(<DealRequestForm title="Консультация" priceRub={500} rights={[right]} pending={false} demurrageRubPerDay={100} nominalFloorRub={100} feeSourceLabel="кошелёк сообщества" onCancel={vi.fn()} onSubmit={vi.fn()} />);

    expect(screen.getByText('Сегодня право: до 5 000 ₽')).toBeVisible();
    expect(screen.getByText('Завтра: до 4 900 ₽')).toBeVisible();
    expect(screen.getByText(/Комиссия 1 заслуга: кошелёк сообщества/)).toBeVisible();
  });

  it('submits a trimmed message and optional deadline', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<DealRequestForm title="Консультация" priceRub={500} rights={[right]} pending={false} onCancel={vi.fn()} onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText(/^Сообщение исполнителю/), '  Нужна помощь  ');
    await user.click(screen.getByRole('button', { name: 'Подтвердить заявку' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ bankId: 'right-1', requestMessage: 'Нужна помощь' }));
  });
});
