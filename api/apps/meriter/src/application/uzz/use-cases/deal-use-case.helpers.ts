import { randomUUID } from 'crypto';
import { UzzAccessPolicy } from '../policies/uzz-access-policy';
import { UzzLedgerEntry, UzzRepositories } from '../ports/uzz-repositories';
import { UzzForbiddenError } from '../../../domain/uzz/errors';

export async function resolveIdentityContext(
  repositories: UzzRepositories,
  userId: string,
) {
  const direct = await repositories.identities.findByCanonicalUserId(userId);
  const alias = direct ? null : await repositories.identities.findAliasByUserId(userId);
  const identity = direct ?? (alias
    ? await repositories.identities.findById(alias.identityId)
    : null);
  const aliases = identity
    ? await repositories.identities.listAliases(identity.id)
    : [];
  return {
    identity,
    userIds: identity
      ? [...new Set([identity.canonicalUserId, ...aliases.map((entry) => entry.aliasUserId)])]
      : [userId],
  };
}

export async function assertReadyMember(
  repositories: UzzRepositories,
  access: UzzAccessPolicy,
  communityId: string,
  userId: string,
) {
  const context = await resolveIdentityContext(repositories, userId);
  access.assertIdentityReady(context.identity);
  await access.assertMember(communityId, context.userIds);
  return { ...context, identity: context.identity! };
}

export async function assertEquivalentActor(
  repositories: UzzRepositories,
  actorId: string,
  participantId: string,
) {
  const context = await resolveIdentityContext(repositories, actorId);
  if (!context.userIds.includes(participantId)) {
    throw new UzzForbiddenError('DEAL_PARTICIPANT_REQUIRED');
  }
  return context;
}

export async function selectWalletPayer(
  repositories: UzzRepositories,
  userIds: string[],
  localCommunityId: string,
  globalCommunityId: string,
  amount: number,
) {
  const balances = await Promise.all(userIds.map(async (userId) => ({
    userId,
    ...(await repositories.wallet.getBalances({
      userId, localCommunityId, globalCommunityId,
    })),
  })));
  return balances.find((entry) => entry.localBalance >= amount)?.userId
    ?? balances.find((entry) => entry.globalBalance >= amount)?.userId
    ?? userIds[0];
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export function appendDealLedger(
  repositories: UzzRepositories,
  entry: Omit<UzzLedgerEntry, 'id'>,
): Promise<void> {
  return repositories.ledger.append({ id: randomUUID(), ...entry });
}

export async function appendTelegramNotification(
  repositories: UzzRepositories,
  input: {
    operationId: string;
    aggregateId: string;
    communityId: string;
    targetUserId: string;
    kind: string;
    text: string;
    now: Date;
  },
): Promise<void> {
  const settings = await repositories.settings.findByCommunityId(input.communityId);
  const settingKey = notificationSettingKey(input.kind);
  if (settingKey && settings?.[settingKey] === false) return;
  const { identity } = await resolveIdentityContext(repositories, input.targetUserId);
  if (!identity?.telegramUserId) return;
  await repositories.outbox.append({
    id: `${input.operationId}:telegram:${input.targetUserId}:${input.kind}`,
    topic: 'uzz.telegram',
    aggregateId: input.aggregateId,
    payload: {
      telegramUserId: identity.telegramUserId,
      text: input.text,
      path: input.kind === 'right_emitted' ? '/' : '/deals',
      kind: input.kind,
      targetUserId: input.targetUserId,
    },
    attempts: 0,
    availableAt: new Date(input.now),
    processedAt: null,
    lockedUntil: null,
    deadLetteredAt: null,
    lastError: null,
    leaseToken: null,
    leaseOwner: null,
    createdAt: new Date(input.now),
  });
}

function notificationSettingKey(kind: string):
  | 'notifyRightEmitted'
  | 'notifyRequestLifecycle'
  | 'notifyDealProgress'
  | 'notifyDealClosed'
  | null {
  if (kind === 'right_emitted') return 'notifyRightEmitted';
  if (['deal_requested', 'deal_cancelled', 'deal_rejected'].includes(kind)) {
    return 'notifyRequestLifecycle';
  }
  if (['deal_accepted', 'deal_completed'].includes(kind)) return 'notifyDealProgress';
  if (kind === 'deal_closed') return 'notifyDealClosed';
  return null;
}
