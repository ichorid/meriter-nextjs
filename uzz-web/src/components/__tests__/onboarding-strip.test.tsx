import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OnboardingStrip } from '@/components/onboarding-strip';

describe('OnboardingStrip', () => {
  it('lays out the three steps that lead to an exchange', () => {
    render(<OnboardingStrip onDismiss={vi.fn()} />);

    const steps = screen.getAllByRole('listitem');
    expect(steps).toHaveLength(3);
    expect(steps[0]).toHaveTextContent('Доброе дело');
    expect(steps[1]).toHaveTextContent('Банк на обмен');
    expect(steps[2]).toHaveTextContent('Обмен');
  });

  it('states that the threshold is counted per post', () => {
    render(<OnboardingStrip onDismiss={vi.fn()} />);

    expect(screen.getByText(/Один пост, набравший порог заслуг/)).toBeVisible();
  });

  it('can be dismissed', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<OnboardingStrip onDismiss={onDismiss} />);

    await user.click(screen.getByRole('button', { name: 'Скрыть подсказку' }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
