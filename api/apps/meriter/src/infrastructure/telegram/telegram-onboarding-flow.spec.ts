import {
  listOnboardingActions,
  formatOnboardingStepPrompt,
} from './telegram-onboarding-flow';

describe('telegram-onboarding-flow', () => {
  it('omits moderation and publication ack when platform integration is off', () => {
    const actions = listOnboardingActions({
      platformIntegration: false,
      quotaEnabled: false,
    });
    expect(actions).toEqual([
      'onboarding_name',
      'onboarding_platform_integration',
      'onboarding_quota_enabled',
      'onboarding_hashtag',
      'onboarding_post_cost',
      'onboarding_welcome_merits',
    ]);
    expect(actions).not.toContain('onboarding_moderation');
    expect(actions).not.toContain('onboarding_publication_ack');
  });

  it('includes moderation and publication ack when platform integration is on', () => {
    const actions = listOnboardingActions({
      platformIntegration: true,
      platformVisibility: 'private',
      quotaEnabled: true,
    });
    expect(actions).toContain('onboarding_moderation');
    expect(actions).toContain('onboarding_publication_ack');
    expect(actions).not.toContain('onboarding_future_vision');
  });

  it('numbers welcome step as last step in chat-only flow', () => {
    const prompt = formatOnboardingStepPrompt('onboarding_welcome_merits', {
      platformIntegration: false,
      quotaEnabled: false,
    }, 'Welcome body');
    expect(prompt).toBe('Шаг 6 из 6\n\nWelcome body');
  });

  it('numbers moderation as step 7 in platform private flow without quota amount', () => {
    const payload = {
      platformIntegration: true,
      platformVisibility: 'private' as const,
      quotaEnabled: false,
    };
    const prompt = formatOnboardingStepPrompt('onboarding_moderation', payload, 'Mod body');
    expect(prompt).toBe('Шаг 7 из 9\n\nMod body');
  });
});
