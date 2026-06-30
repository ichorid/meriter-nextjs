import {
  cycleTelegramCommandDelivery,
  commandRoutingFromOnboardingPreset,
  parseOnboardingCommandDeliveryInput,
  resolveTelegramCommandDelivery,
  formatTelegramCommandDeliveryLabel,
} from './telegram-command-routing';

describe('telegram-command-routing', () => {
  it('defaults to group ephemeral when routing is missing', () => {
    expect(resolveTelegramCommandDelivery(undefined, 'balance')).toEqual({
      destination: 'group',
      ephemeral: true,
    });
  });

  it('cycles group ephemeral → group permanent → dm', () => {
    expect(cycleTelegramCommandDelivery({ destination: 'group', ephemeral: true })).toEqual({
      destination: 'group',
      ephemeral: false,
    });
    expect(cycleTelegramCommandDelivery({ destination: 'group', ephemeral: false })).toEqual({
      destination: 'dm',
      ephemeral: false,
    });
    expect(cycleTelegramCommandDelivery({ destination: 'dm', ephemeral: false })).toEqual({
      destination: 'group',
      ephemeral: true,
    });
  });

  it('builds onboarding preset for all four commands', () => {
    const routing = commandRoutingFromOnboardingPreset('dm');
    expect(routing.balance).toEqual({ destination: 'dm', ephemeral: false });
    expect(routing.link).toEqual({ destination: 'dm', ephemeral: false });
  });

  it('parses onboarding numeric answers', () => {
    expect(parseOnboardingCommandDeliveryInput('1')).toBe('group_ephemeral');
    expect(parseOnboardingCommandDeliveryInput('2')).toBe('group_permanent');
    expect(parseOnboardingCommandDeliveryInput('3')).toBe('dm');
  });

  it('formats delivery labels', () => {
    expect(formatTelegramCommandDeliveryLabel('help', { destination: 'group', ephemeral: true })).toBe(
      '/help: группа эф.',
    );
    expect(formatTelegramCommandDeliveryLabel('link', { destination: 'dm', ephemeral: false })).toBe(
      '/link: личка',
    );
  });
});
