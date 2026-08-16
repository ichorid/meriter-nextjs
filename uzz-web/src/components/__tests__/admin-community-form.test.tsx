import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AdminCommunityForm } from '@/components/admin-community-form';

const communities = [
  { id: 'pilot', name: 'Пилот «Услуги за заслуги»' },
  { id: 'ruslan', name: 'Заслуги бот Руслан' },
];

describe('AdminCommunityForm', () => {
  it('saves a different membership and keeps the current stand disabled', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <AdminCommunityForm
        communities={communities}
        selectedCommunityId="pilot"
        pending={false}
        onSave={onSave}
      />,
    );

    expect(screen.getByLabelText('Сообщество')).toHaveValue('pilot');
    expect(screen.getByRole('button', { name: 'Сохранить сообщество' })).toBeDisabled();

    await user.selectOptions(screen.getByLabelText('Сообщество'), 'ruslan');
    await user.click(screen.getByRole('button', { name: 'Сохранить сообщество' }));

    expect(onSave).toHaveBeenCalledWith('ruslan');
  });
});
