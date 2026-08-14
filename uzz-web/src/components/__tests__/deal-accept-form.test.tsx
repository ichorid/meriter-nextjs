import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DealAcceptForm } from '@/components/deal-accept-form';
import { DealRequestForm } from '@/components/deal-request-form';
import { DEAL_DEADLINE_NOT_FUTURE_MESSAGE, minimumLocalDeadline } from '@/lib/local-datetime';

const right = { id: 'right-1', nominalRub: 5000, status: 'active', hopsLeft: 10 };

describe('DealAcceptForm local deadline', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('prefills datetime-local from calendar components instead of a UTC ISO slice', () => {
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

    expect(screen.getByLabelText(/^Согласованный срок/)).toHaveValue('2026-08-14T18:00');
    expect(screen.getByLabelText(/^Согласованный срок/)).not.toHaveValue('2026-08-14T11:00');
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

  it('blocks a past deadline with a dedicated Russian inline error', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-14T11:00:00.000Z'));
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(0);
    const onAccept = vi.fn();
    render(
      <DealAcceptForm currentNominalRub={600} pending={false} onCancel={vi.fn()} onAccept={onAccept} />,
    );

    const input = screen.getByLabelText(/^Согласованный срок/);
    expect(input).toHaveAttribute('min', minimumLocalDeadline(new Date('2026-08-14T11:00:00.000Z'), 0));
    fireEvent.change(input, { target: { value: '2026-08-14T11:04' } });
    fireEvent.submit(input.closest('form')!);

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

  it('blocks a past requested deadline with a dedicated Russian inline error', () => {
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

    fireEvent.change(screen.getByLabelText(/^Сообщение исполнителю/), { target: { value: 'Нужна помощь' } });
    const input = screen.getByLabelText(/^Желаемый срок/);
    expect(input).toHaveAttribute('min', minimumLocalDeadline(new Date('2026-08-14T11:00:00.000Z'), 0));
    fireEvent.change(input, { target: { value: '2026-08-13T18:00' } });
    fireEvent.submit(input.closest('form')!);

    expect(screen.getByRole('alert')).toHaveTextContent(DEAL_DEADLINE_NOT_FUTURE_MESSAGE);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
