import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DealAcceptForm } from '@/components/deal-accept-form';
import { DealRequestForm } from '@/components/deal-request-form';
import { DEAL_DEADLINE_NOT_FUTURE_MESSAGE, formatDeadlineLabel } from '@/lib/local-datetime';

const right = { id: 'right-1', nominalRub: 5000, status: 'active', hopsLeft: 10 };

describe('DealAcceptForm local deadline', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('prefills the calendar trigger from local calendar parts instead of a UTC ISO slice', () => {
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-420);
    render(
      <DealAcceptForm
        currentNominalRub={600}
        requestedDeadlineAt="2026-08-14T11:00:00.000Z"
        pending={false}
        onCancel={vi.fn()}
        onAccept={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /Согласованный срок/ })).toHaveTextContent(
      formatDeadlineLabel('2026-08-14T11:00:00.000Z', -420),
    );
    expect(screen.queryByDisplayValue('2026-08-14T11:00')).not.toBeInTheDocument();
  });

  it('submits the agreed deadline as the original UTC instant', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-14T10:00:00.000Z'));
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-420);
    const onAccept = vi.fn();
    render(
      <DealAcceptForm
        currentNominalRub={600}
        requestedDeadlineAt="2026-08-14T11:00:00.000Z"
        pending={false}
        onCancel={vi.fn()}
        onAccept={onAccept}
      />,
    );

    fireEvent.submit(screen.getByRole('button', { name: /Принять на 600 ₽/ }).closest('form')!);
    expect(onAccept).toHaveBeenCalledTimes(1);
    const deadline = onAccept.mock.calls[0][0] as Date;
    expect(deadline.toISOString()).toBe('2026-08-14T11:00:00.000Z');
  });

  it('blocks a too-soon deadline with a dedicated Russian inline error', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-14T11:00:00.000Z'));
    const onAccept = vi.fn();
    render(
      <DealAcceptForm
        currentNominalRub={600}
        agreedDeadlineAt="2026-08-14T11:04:00.000Z"
        pending={false}
        onCancel={vi.fn()}
        onAccept={onAccept}
      />,
    );

    fireEvent.submit(screen.getByRole('button', { name: /Принять на 600 ₽/ }).closest('form')!);
    expect(screen.getByRole('alert')).toHaveTextContent(DEAL_DEADLINE_NOT_FUTURE_MESSAGE);
    expect(onAccept).not.toHaveBeenCalled();
  });

  it('shows the mapped server deadline error inline', () => {
    render(
      <DealAcceptForm
        currentNominalRub={600}
        pending={false}
        error="DEAL_DEADLINE_NOT_FUTURE"
        onCancel={vi.fn()}
        onAccept={vi.fn()}
      />,
    );

    expect(screen.getByText(DEAL_DEADLINE_NOT_FUTURE_MESSAGE)).toBeVisible();
  });
});

describe('DealRequestForm local deadline', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('submits without a deadline when the calendar stays empty', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <DealRequestForm
        title="Консультация"
        priceRub={500}
        rights={[right]}
        pending={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText(/^Сообщение исполнителю/), 'Тест');
    expect(screen.getByRole('button', { name: /Желаемый срок/ })).toHaveTextContent('Не указан');
    await user.click(screen.getByRole('button', { name: 'Подтвердить заявку' }));
    expect(onSubmit).toHaveBeenCalledWith({
      bankId: 'right-1',
      requestMessage: 'Тест',
      requestedDeadlineAt: undefined,
    });
  });

  it('lets the buyer pick a future day from the calendar', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-14T11:00:00.000Z'));
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(0);
    const onSubmit = vi.fn();
    render(
      <DealRequestForm
        title="Консультация"
        priceRub={500}
        rights={[right]}
        pending={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText(/^Сообщение исполнителю/), { target: { value: 'Тест' } });
    fireEvent.click(screen.getByRole('button', { name: /Желаемый срок/ }));
    fireEvent.click(screen.getByRole('button', { name: /20 августа 2026/ }));
    fireEvent.submit(screen.getByRole('button', { name: 'Подтвердить заявку' }).closest('form')!);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0] as { requestedDeadlineAt?: Date };
    expect(payload.requestedDeadlineAt?.toISOString()).toBe('2026-08-20T11:15:00.000Z');
  });
});
