import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HoldingBanksNotice } from '@/components/holding-banks-notice';

describe('HoldingBanksNotice', () => {
  it('lists banks that wait for profile linking', () => {
    render(
      <HoldingBanksNotice
        banks={[
          {
            id: 'right-1',
            ownerName: 'Дмитрий',
            sourceTitle: '#заслуга тест',
            sourceScore: 10,
          },
        ]}
      />,
    );

    expect(screen.getByText(/Ждут привязку профиля: 1/)).toBeVisible();
    expect(screen.getByText('Дмитрий')).toBeVisible();
    expect(screen.getByText('#заслуга тест · 10 заслуг')).toBeVisible();
  });

  it('renders nothing when the holding queue is empty', () => {
    const { container } = render(<HoldingBanksNotice banks={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
