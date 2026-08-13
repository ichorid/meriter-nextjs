import { randomUUID } from 'crypto';
import { UzzAccessPolicy } from '../policies/uzz-access-policy';
import { UzzLedgerEntry, UzzRepositories } from '../ports/uzz-repositories';

export async function assertReadyMember(
  repositories: UzzRepositories,
  access: UzzAccessPolicy,
  communityId: string,
  userId: string,
) {
  const identity = await repositories.identities.findByCanonicalUserId(userId);
  const aliases = identity
    ? await repositories.identities.listAliases(identity.id)
    : [];
  await access.assertMember(communityId, [
    userId,
    ...aliases.map((alias) => alias.aliasUserId),
  ]);
  access.assertIdentityReady(identity);
  return identity!;
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
    targetUserId: string;
    kind: string;
    text: string;
    now: Date;
  },
): Promise<void> {
  const identity = await repositories.identities.findByCanonicalUserId(input.targetUserId);
  if (!identity?.telegramUserId) return;
  await repositories.outbox.append({
    id: `${input.operationId}:telegram:${input.targetUserId}:${input.kind}`,
    topic: 'uzz.telegram',
    aggregateId: input.aggregateId,
    payload: {
      telegramUserId: identity.telegramUserId,
      text: input.text,
      kind: input.kind,
      targetUserId: input.targetUserId,
    },
    attempts: 0,
    availableAt: new Date(input.now),
    processedAt: null,
    lockedUntil: null,
    deadLetteredAt: null,
    lastError: null,
    createdAt: new Date(input.now),
  });
}
