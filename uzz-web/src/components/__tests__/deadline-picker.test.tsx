import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DeadlinePicker } from '@/components/deadline-picker';

const MONTH_TITLE = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' });

function currentMonthTitle(): string {
  const raw = MONTH_TITLE.format(new Date());
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function renderPicker(value: Date | null = null) {
  const onChange = vi.fn();
  render(
    <DeadlinePicker id="deadline" label="Желаемый срок" value={value} onChange={onChange} />,
  );
  return { onChange };
}

describe('DeadlinePicker', () => {
  it('opens on the current month', async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.click(screen.getByRole('button', { name: 'Желаемый срок' }));

    expect(screen.getByText(currentMonthTitle())).toBeVisible();
  });

  it('returns to the current month after browsing away and closing without a pick', async () => {
    const user = userEvent.setup();
    renderPicker();

    const toggle = screen.getByRole('button', { name: 'Желаемый срок' });
    await user.click(toggle);
    const forward = screen.getByRole('button', { name: 'Следующий месяц' });
    await user.click(forward);
    await user.click(forward);
    await user.click(forward);
    expect(screen.queryByText(currentMonthTitle())).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Готово' }));
    await user.click(toggle);

    expect(screen.getByText(currentMonthTitle())).toBeVisible();
  });

  it('opens on the month of the already chosen deadline', async () => {
    const user = userEvent.setup();
    const chosen = new Date();
    chosen.setMonth(chosen.getMonth() + 2);
    const chosenTitle = MONTH_TITLE.format(chosen);
    renderPicker(chosen);

    await user.click(screen.getByRole('button', { name: 'Желаемый срок' }));

    expect(
      screen.getByText(chosenTitle.charAt(0).toUpperCase() + chosenTitle.slice(1)),
    ).toBeVisible();
  });
});
