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
