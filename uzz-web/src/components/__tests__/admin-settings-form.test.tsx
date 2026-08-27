import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AdminSettingsForm, type AdminSettings } from '@/components/admin-settings-form';
import { dealStatusLabel } from '@/lib/utils';

const settings: AdminSettings = { emissionThreshold: 10, initialHops: 10, demurrageRubPerDay: 100, nominalFloorRub: 100, minimumListingsToBuy: 3, purchaseGateMode: 'nudge', requestTtlHours: 48, fulfillmentTtlDays: 7, confirmationTtlDays: 7, notifyRightEmitted: true, notifyRequestLifecycle: true, notifyDealProgress: true, notifyDealClosed: true, groupAnnounceRightEmitted: true, groupAnnounceDealClosed: true };

describe('AdminSettingsForm', () => {
  it('requires explicit confirmation for floor and TTL changes', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<AdminSettingsForm settings={settings} pending={false} onSave={onSave} />);
    await user.clear(screen.getByLabelText(/^Нижний номинал/));
    await user.type(screen.getByLabelText(/^Нижний номинал/), '200');
    await user.click(screen.getByRole('button', { name: 'Сохранить настройки' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Изменение нижнего номинала или сроков/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Применить изменения' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ nominalFloorRub: 200 }));
  });

  it('uses exact integer bounds and keeps nudge as default', () => {
    render(<AdminSettingsForm settings={settings} pending={false} onSave={vi.fn()} />);
    expect(screen.getByLabelText(/^Порог заслуг/)).toHaveAttribute('max', '1000000');
    expect(screen.getByLabelText(/^Рекомендовано услуг/)).toHaveAttribute('max', '100');
    expect(screen.getByLabelText('Режим взаимности')).toHaveValue('nudge');
  });

  it('lets an admin configure each Telegram notification class', () => {
    render(<AdminSettingsForm settings={settings} pending={false} onSave={vi.fn()} />);
    expect(screen.getByLabelText('Появился банк на обмен')).toBeChecked();
    expect(screen.getByLabelText('Новая заявка или отмена')).toBeChecked();
    expect(screen.getByLabelText('Заявка принята или услуга сделана')).toBeChecked();
    expect(screen.getByLabelText('Сделка закрыта')).toBeChecked();
    expect(screen.getByLabelText('У участника появился банк на обмен')).toBeChecked();
  });

  it('keeps group-chat announces off unless the admin opts in', () => {
    render(<AdminSettingsForm settings={{ ...settings, groupAnnounceRightEmitted: false, groupAnnounceDealClosed: false }} pending={false} onSave={vi.fn()} />);
    expect(screen.getByLabelText('У участника появился банк на обмен')).not.toBeChecked();
    expect(screen.getByLabelText('Состоялась сделка')).not.toBeChecked();
  });

  it('rejects a fractional ruble value, uses step=1, and shows integer guidance', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<AdminSettingsForm settings={settings} pending={false} onSave={onSave} />);

    const demurrage = screen.getByLabelText(/^Таяние/);
    expect(demurrage).toHaveAttribute('step', '1');
    expect(screen.getByLabelText(/^Нижний номинал/)).toHaveAttribute('step', '1');

    await user.clear(demurrage);
    await user.type(demurrage, '12.5');
    await user.click(screen.getByRole('button', { name: 'Сохранить настройки' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Введите целое число рублей')).toBeVisible();
  });
});

describe('dealStatusLabel', () => {
  it.each([
    ['requested', 'Ждёт ответа'],
    ['accepted', 'В работе'],
    ['completed_by_seller', 'Ждёт подтверждения'],
    ['closed', 'Завершена'],
    ['cancelled', 'Отменена'],
    ['rejected', 'Отклонена'],
    ['expired', 'Истекла'],
  ] as const)('localizes %s', (status, label) => {
    expect(dealStatusLabel(status)).toBe(label);
  });

  it('renders unknown status copy and emits telemetry', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(dealStatusLabel('not_a_real_status')).toBe('Неизвестный статус');
    expect(warn).toHaveBeenCalledWith('uzz.unknown_deal_status', 'not_a_real_status');
    warn.mockRestore();
  });
});
