import { ExchangeRight } from '../../../domain/uzz/entities/exchange-right';
import { Rubles } from '../../../domain/uzz/value-objects/rubles';
import {
  UzzRepositories,
  UzzSettingsRecord,
} from '../ports/uzz-repositories';
import { isIdentityReady } from '../policies/uzz-access-policy';
import { defaultSettings } from '../uzz-settings';
import { appendDealLedger, resolveIdentityContext } from './deal-use-case.helpers';

export async function maybeAutoAssignNominal(
  repositories: UzzRepositories,
  right: ExchangeRight,
  settings: UzzSettingsRecord,
  now: Date,
  actorId: string,
  operationId: string,
): Promise<void> {
  if (!settings.autoAssignNominal) return;
  if (right.snapshot().status !== 'awaiting_nominal') return;
  right.assignNominal(
    Rubles.create(settings.defaultNominalRub),
    Rubles.create(settings.nominalFloorRub),
    now,
  );
  const snapshot = right.snapshot();
  await appendDealLedger(repositories, {
    operationId,
    communityId: snapshot.communityId,
    userId: snapshot.ownerId,
    type: 'nominal_assigned',
    amount: settings.defaultNominalRub,
    createdAt: now,
    metadata: {
      rightId: snapshot.id,
      source: 'auto_assign',
      actorId,
    },
  });
}

export async function releaseHoldingRightsAfterIdentityReady(
  repositories: UzzRepositories,
  ownerIds: string[],
  now: Date,
): Promise<void> {
  const holdingRights = await repositories.rights.listHoldingByOwners(ownerIds);
  for (const right of holdingRights) {
    right.promoteAfterIdentityLink(now);
    const snapshot = right.snapshot();
    const settings = await repositories.settings.findByCommunityId(snapshot.communityId)
      ?? defaultSettings(snapshot.communityId, now);
    await maybeAutoAssignNominal(
      repositories,
      right,
      settings,
      now,
      snapshot.ownerId,
      `identity-link:${snapshot.id}`,
    );
    await repositories.rights.update(right);
  }
}

export async function releaseReadyHoldingRightsInCommunity(
  repositories: UzzRepositories,
  communityId: string,
  now: Date,
): Promise<void> {
  const holding = await repositories.rights.listByStatus(communityId, ['holding']);
  const seenOwners = new Set<string>();
  for (const right of holding) {
    const ownerId = right.snapshot().ownerId;
    if (seenOwners.has(ownerId)) continue;
    seenOwners.add(ownerId);
    const { identity, userIds } = await resolveIdentityContext(repositories, ownerId);
    if (!isIdentityReady(identity)) continue;
    await releaseHoldingRightsAfterIdentityReady(repositories, userIds, now);
  }
}
