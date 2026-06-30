import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { CommunityEffectiveSettingsService } from '../src/domain/services/community-effective-settings.service';
import { CommunityDefaultsService } from '../src/domain/services/community-defaults.service';
import type { Community } from '../src/domain/models/community/community.schema';

describe('CommunityEffectiveSettingsService.startingMeritsOnJoin', () => {
  let service: CommunityEffectiveSettingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityEffectiveSettingsService,
        CommunityDefaultsService,
        { provide: getConnectionToken(), useValue: {} },
      ],
    }).compile();

    service = module.get(CommunityEffectiveSettingsService);
  });

  it('uses explicit welcome merits instead of daily quota', () => {
    const community = {
      id: 'community-1',
      typeTag: 'team',
      meritSettings: {
        startingMerits: 97,
        dailyQuota: 13,
        quotaEnabled: true,
      },
    } as Community;

    expect(service.startingMeritsOnJoin(community)).toBe(97);
  });

  it('uses type defaults when welcome merits are not configured', () => {
    const community = {
      id: 'community-1',
      typeTag: 'team',
      meritSettings: {
        dailyQuota: 13,
        quotaEnabled: true,
      },
    } as Community;

    expect(service.startingMeritsOnJoin(community)).toBe(10);
  });
});
