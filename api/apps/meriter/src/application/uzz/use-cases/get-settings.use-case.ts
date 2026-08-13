import { UzzUnitOfWork } from '../ports/uzz-unit-of-work';
import { defaultSettings } from '../uzz-settings';

export interface UzzParticipantAccess {
  assertCommunityParticipant(communityId: string, userId: string): Promise<void>;
}

export class GetSettingsUseCase {
  constructor(
    private readonly unitOfWork: UzzUnitOfWork,
    private readonly access: UzzParticipantAccess,
  ) {}

  async execute(input: { communityId: string; userId: string; now?: Date }) {
    await this.access.assertCommunityParticipant(input.communityId, input.userId);
    return this.unitOfWork.run(async (repositories) =>
      await repositories.settings.findByCommunityId(input.communityId)
        ?? defaultSettings(input.communityId, input.now ?? new Date()),
    );
  }
}
