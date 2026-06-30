/** Delivery target for /balance, /members, /help, /link in Telegram groups. */

export type TelegramRoutableCommand = 'balance' | 'members' | 'help' | 'link';

export type TelegramCommandDelivery = {
  destination: 'group' | 'dm';
  /** Only applies when destination === 'group'. Default true. */
  ephemeral?: boolean;
};

export type TelegramCommandRoutingSettings = Partial<
  Record<TelegramRoutableCommand, TelegramCommandDelivery>
>;

export const TELEGRAM_ROUTABLE_COMMANDS: TelegramRoutableCommand[] = [
  'balance',
  'members',
  'help',
  'link',
];

export const DEFAULT_TELEGRAM_COMMAND_DELIVERY: TelegramCommandDelivery = {
  destination: 'group',
  ephemeral: true,
};

export function resolveTelegramCommandDelivery(
  routing: TelegramCommandRoutingSettings | null | undefined,
  cmd: TelegramRoutableCommand,
): TelegramCommandDelivery {
  const entry = routing?.[cmd];
  if (!entry) {
    return { ...DEFAULT_TELEGRAM_COMMAND_DELIVERY };
  }
  if (entry.destination === 'dm') {
    return { destination: 'dm', ephemeral: false };
  }
  return {
    destination: 'group',
    ephemeral: entry.ephemeral !== false,
  };
}

/** Cycle: group+ephemeral → group+permanent → dm → group+ephemeral */
export function cycleTelegramCommandDelivery(
  current: TelegramCommandDelivery | undefined,
): TelegramCommandDelivery {
  const resolved = current?.destination === 'dm'
    ? { destination: 'dm' as const, ephemeral: false }
    : {
        destination: 'group' as const,
        ephemeral: current?.ephemeral !== false,
      };

  if (resolved.destination === 'group' && resolved.ephemeral) {
    return { destination: 'group', ephemeral: false };
  }
  if (resolved.destination === 'group' && !resolved.ephemeral) {
    return { destination: 'dm', ephemeral: false };
  }
  return { ...DEFAULT_TELEGRAM_COMMAND_DELIVERY };
}

export function formatTelegramCommandDeliveryLabel(
  cmd: TelegramRoutableCommand,
  delivery: TelegramCommandDelivery,
): string {
  const prefix =
    cmd === 'balance'
      ? '/balance'
      : cmd === 'members'
        ? '/members'
        : cmd === 'help'
          ? '/help'
          : '/link';
  if (delivery.destination === 'dm') {
    return `${prefix}: личка`;
  }
  return delivery.ephemeral ? `${prefix}: группа эф.` : `${prefix}: группа`;
}

export type OnboardingCommandDeliveryPreset = 'group_ephemeral' | 'group_permanent' | 'dm';

export function commandRoutingFromOnboardingPreset(
  preset: OnboardingCommandDeliveryPreset,
): TelegramCommandRoutingSettings {
  const delivery: TelegramCommandDelivery =
    preset === 'dm'
      ? { destination: 'dm', ephemeral: false }
      : preset === 'group_permanent'
        ? { destination: 'group', ephemeral: false }
        : { ...DEFAULT_TELEGRAM_COMMAND_DELIVERY };

  return {
    balance: { ...delivery },
    members: { ...delivery },
    help: { ...delivery },
    link: { ...delivery },
  };
}

export function parseOnboardingCommandDeliveryInput(text: string): OnboardingCommandDeliveryPreset | null {
  const n = text.trim().toLowerCase();
  if (n === '1' || n.includes('group_ephemeral') || n.includes('эфемер')) {
    return 'group_ephemeral';
  }
  if (n === '2' || n.includes('group_permanent') || n.includes('оста')) {
    return 'group_permanent';
  }
  if (n === '3' || n === 'dm' || n.includes('личк')) {
    return 'dm';
  }
  return null;
}
