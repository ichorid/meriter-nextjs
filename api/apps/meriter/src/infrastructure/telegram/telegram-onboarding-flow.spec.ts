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
      'onboarding_quota_enabled',
      'onboarding_hashtag',
      'onboarding_post_cost',
      'onboarding_welcome_merits',
      'onboarding_vote_panel',
      'onboarding_new_member_welcome',
      'onboarding_command_delivery',
    ]);
    expect(actions).not.toContain('onboarding_platform_integration');
    expect(actions).not.toContain('onboarding_moderation');
    expect(actions).not.toContain('onboarding_publication_ack');
  });

  it('omits platform integration step while TELEGRAM onboarding platform step is disabled', () => {
    const actions = listOnboardingActions({});
    expect(actions).not.toContain('onboarding_platform_integration');
    expect(actions[1]).toBe('onboarding_quota_enabled');
  });

  it('ignores platformIntegration payload while platform step is disabled', () => {
    const actions = listOnboardingActions({
      platformIntegration: true,
      platformVisibility: 'private',
      quotaEnabled: true,
    });
    expect(actions).not.toContain('onboarding_platform_integration');
    expect(actions).not.toContain('onboarding_platform_visibility');
    expect(actions).not.toContain('onboarding_moderation');
    expect(actions).not.toContain('onboarding_publication_ack');
  });

  it('numbers welcome step before vote panel in chat-only flow', () => {
    const prompt = formatOnboardingStepPrompt('onboarding_welcome_merits', {
      platformIntegration: false,
      quotaEnabled: false,
    }, 'Welcome body');
    expect(prompt).toBe('Шаг 5 из 8\n\nWelcome body');
  });
});
