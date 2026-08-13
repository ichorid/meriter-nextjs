import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { ThanksForm } from '@/components/thanks-form';

it('rejects a fractional merit amount before submitting', async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  render(<ThanksForm pending={false} onCancel={() => undefined} onSubmit={onSubmit} />);

  const amount = screen.getByPlaceholderText('Заслуг, если хотите добавить');
  await user.type(amount, '1.5');
  await user.click(screen.getByRole('button', { name: 'Отправить' }));

  expect(screen.getByRole('alert')).toHaveTextContent('целым числом');
  expect(onSubmit).not.toHaveBeenCalled();
});
