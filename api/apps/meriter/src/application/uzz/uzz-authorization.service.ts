import { UzzForbiddenError } from '../../domain/uzz/errors';
import { UzzCommunityAccessPort } from './ports/uzz-community-access.port';
import { UzzUnitOfWork } from './ports/uzz-unit-of-work';

export class UzzAuthorizationService {
  constructor(
    private readonly unitOfWork: UzzUnitOfWork,
    private readonly access: UzzCommunityAccessPort,
  ) {}

  async resolveUserIds(userId: string): Promise<string[]> {
    return this.unitOfWork.run(async (repositories) => {
      const direct = await repositories.identities.findByCanonicalUserId(userId);
      const alias = direct ? null : await repositories.identities.findAliasByUserId(userId);
      const identity = direct ?? (alias
        ? await repositories.identities.findById(alias.identityId)
        : null);
      if (!identity) return [userId];
      const aliases = await repositories.identities.listAliases(identity.id);
      return [...new Set([
        identity.canonicalUserId,
        ...aliases.map((entry) => entry.aliasUserId),
      ])];
    });
  }

  async assertCommunityParticipant(communityId: string, userId: string): Promise<void> {
    const userIds = await this.resolveUserIds(userId);
    if (await this.access.isSuperAdmin?.(userIds)) return;
    if (await this.access.isAnyMember(communityId, userIds)) return;
    throw new UzzForbiddenError('COMMUNITY_MEMBERSHIP_REQUIRED');
  }

  async assertCommunityAdmin(communityId: string, userId: string): Promise<void> {
    const userIds = await this.resolveUserIds(userId);
    if (await this.access.isSuperAdmin?.(userIds)) return;
    if (await this.access.isAnyAdmin?.(communityId, userIds)) return;
    throw new UzzForbiddenError('COMMUNITY_ADMIN_REQUIRED');
  }
}
