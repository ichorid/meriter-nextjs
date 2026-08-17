import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AdminNominalSettings } from '@/components/admin-nominal-settings';

describe('AdminNominalSettings', () => {
  it('asks for confirmation before enabling auto-assign', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <AdminNominalSettings
        settings={{ autoAssignNominal: false, defaultNominalRub: 100, nominalFloorRub: 100 }}
        pending={false}
        onSave={onSave}
      />,
    );

    await user.click(screen.getByLabelText('Автоназначение номинала'));
    await user.click(screen.getByRole('button', { name: 'Сохранить назначение номинала' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Все банки в очереди сразу получат номинал/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Включить автоназначение' }));
    expect(onSave).toHaveBeenCalledWith({ autoAssignNominal: true, defaultNominalRub: 100 });
  });
});
