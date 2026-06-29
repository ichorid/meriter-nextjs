import type { TelegramBotPendingActionType } from '../../domain/models/telegram/telegram-bot-pending-action.schema';

export type OnboardingFlowPayload = {
  platformIntegration?: boolean;
  platformVisibility?: 'private' | 'public';
  quotaEnabled?: boolean;
};

/**
 * When false, onboarding skips «Интегрировать с платформой Meriter?» and defaults to chat-only.
 * Re-enable when full community-web / platform integration ships.
 */
export const TELEGRAM_ONBOARDING_PLATFORM_INTEGRATION_STEP_ENABLED = false;

const ONBOARDING_FLOW_ACTIONS: TelegramBotPendingActionType[] = [
  'onboarding_name',
  'onboarding_platform_integration',
  'onboarding_platform_visibility',
  'onboarding_future_vision',
  'onboarding_quota_enabled',
  'onboarding_quota_amount',
  'onboarding_hashtag',
  'onboarding_post_cost',
  'onboarding_moderation',
  'onboarding_publication_ack',
  'onboarding_welcome_merits',
];

/** Ordered onboarding steps for the current answers (platform-only steps omitted when integration is off). */
export function listOnboardingActions(payload: OnboardingFlowPayload): TelegramBotPendingActionType[] {
  const actions: TelegramBotPendingActionType[] = [];
  const platformIntegrationActive =
    TELEGRAM_ONBOARDING_PLATFORM_INTEGRATION_STEP_ENABLED &&
    payload.platformIntegration === true;

  for (const action of ONBOARDING_FLOW_ACTIONS) {
    if (
      action === 'onboarding_platform_integration' &&
      !TELEGRAM_ONBOARDING_PLATFORM_INTEGRATION_STEP_ENABLED
    ) {
      continue;
    }

    if (action === 'onboarding_platform_visibility' || action === 'onboarding_future_vision') {
      if (!platformIntegrationActive) {
        continue;
      }
      if (action === 'onboarding_future_vision' && payload.platformVisibility !== 'public') {
        continue;
      }
    }

    if (action === 'onboarding_quota_amount' && payload.quotaEnabled !== true) {
      continue;
    }

    if (
      (action === 'onboarding_moderation' || action === 'onboarding_publication_ack') &&
      !platformIntegrationActive
    ) {
      continue;
    }

    actions.push(action);
  }

  return actions;
}

export function formatOnboardingStepPrompt(
  action: TelegramBotPendingActionType,
  payload: OnboardingFlowPayload,
  body: string,
): string {
  const actions = listOnboardingActions(payload);
  const stepIndex = actions.indexOf(action);
  if (stepIndex < 0) {
    throw new Error(`Onboarding action "${action}" is not in flow for payload`);
  }
  return `Шаг ${stepIndex + 1} из ${actions.length}\n\n${body}`;
}
