import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AdminSettingsForm, type AdminSettings } from '@/components/admin-settings-form';

const settings: AdminSettings = { emissionThreshold: 10, initialHops: 10, demurrageRubPerDay: 100, nominalFloorRub: 100, minimumListingsToBuy: 3, purchaseGateMode: 'nudge', requestTtlHours: 48, fulfillmentTtlDays: 7, confirmationTtlDays: 7, notifyRightEmitted: true, notifyRequestLifecycle: true, notifyDealProgress: true, notifyDealClosed: true };

describe('AdminSettingsForm', () => {
  it('requires explicit confirmation for floor and TTL changes', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<AdminSettingsForm settings={settings} pending={false} onSave={onSave} />);
    await user.clear(screen.getByLabelText('Нижний номинал, ₽'));
    await user.type(screen.getByLabelText('Нижний номинал, ₽'), '200');
    await user.click(screen.getByRole('button', { name: 'Сохранить настройки' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Изменение нижнего номинала или сроков/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Применить изменения' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ nominalFloorRub: 200 }));
  });

  it('uses exact integer bounds and keeps nudge as default', () => {
    render(<AdminSettingsForm settings={settings} pending={false} onSave={vi.fn()} />);
    expect(screen.getByLabelText(/^Порог заслуг/)).toHaveAttribute('max', '1000000');
    expect(screen.getByLabelText('Рекомендовано карточек')).toHaveAttribute('max', '100');
    expect(screen.getByLabelText('Режим взаимности')).toHaveValue('nudge');
  });

  it('lets an admin configure each Telegram notification class', () => {
    render(<AdminSettingsForm settings={settings} pending={false} onSave={vi.fn()} />);
    expect(screen.getByLabelText('Появилось право на обмен')).toBeChecked();
    expect(screen.getByLabelText('Новая заявка или отмена')).toBeChecked();
    expect(screen.getByLabelText('Заявка принята или услуга сделана')).toBeChecked();
    expect(screen.getByLabelText('Сделка закрыта')).toBeChecked();
  });
});
