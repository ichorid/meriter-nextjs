import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';
import {
  CommunitySchemaClass,
  CommunityDocument,
} from '../models/community/community.schema';
import type {
  Community,
  PermissionRule,
  CommunityMeritSettings,
  CommunityVotingSettings,
} from '../models/community/community.schema';
import { UserSchemaClass, UserDocument } from '../models/user/user.schema';
import { WalletSchemaClass, WalletDocument } from '../models/wallet/wallet.schema';
import { EventBus } from '../events/event-bus';
import { MongoArrayUpdateHelper } from '../common/helpers/mongo-array-update.helper';
import { uid } from 'uid';
import { UserService } from './user.service';
import { UserCommunityRoleService } from './user-community-role.service';
import { WalletService } from './wallet.service';
import { CommunityDefaultsService } from './community-defaults.service';
import { GLOBAL_ROLE_SUPERADMIN, COMMUNITY_ROLE_LEAD } from '../common/constants/roles.constants';

export interface CreateCommunityDto {
  id?: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  typeTag?:
    | 'future-vision'
    | 'marathon-of-good'
    | 'support'
    | 'team-projects'
    | 'team'
    | 'political'
    | 'housing'
    | 'volunteer'
    | 'corporate'
    | 'custom';
  settings?: {
    iconUrl?: string;
    currencyNames?: {
      singular: string;
      plural: string;
      genitive: string;
    };
    dailyEmission?: number;
  };
  isPriority?: boolean;
}

export interface UpdateCommunityDto {
  name?: string;
  description?: string;
  avatarUrl?: string;
  coverImageUrl?: string;
  hashtags?: string[];
  hashtagDescriptions?: Record<string, string>;
  settings?: {
    iconUrl?: string;
    currencyNames?: {
      singular: string;
      plural: string;
      genitive: string;
    };
    dailyEmission?: number;
    postCost?: number;
    pollCost?: number;
    forwardCost?: number;
    editWindowMinutes?: number;
    allowEditByOthers?: boolean;
    canPayPostFromQuota?: boolean;
    allowWithdraw?: boolean;
    forwardRule?: 'standard' | 'project';
    language?: 'en' | 'ru';
  };
  votingSettings?: {
    votingRestriction?: 'any' | 'not-same-team';
    currencySource?: 'quota-and-wallet' | 'quota-only' | 'wallet-only';
    spendsMerits?: boolean;
    awardsMerits?: boolean;
    meritConversion?: {
      targetCommunityId: string;
      ratio: number;
    };
  };
  meritSettings?: {
    dailyQuota?: number;
    quotaRecipients?: ('superadmin' | 'lead' | 'participant')[];
    canEarn?: boolean;
    canSpend?: boolean;
    startingMerits?: number;
    quotaEnabled?: boolean;
  };
  isPriority?: boolean;
  permissionRules?: PermissionRule[];
  // Legacy rules fields (for backward compatibility)
  postingRules?: any;
  votingRules?: any;
  visibilityRules?: any;
  meritRules?: any;
  linkedCurrencies?: string[];
  tappalkaSettings?: {
    enabled?: boolean;
    categories?: string[];
    winReward?: number;
    userReward?: number;
    comparisonsRequired?: number;
    showCost?: number;
    minRating?: number;
    onboardingText?: string;
  };
}

@Injectable()
export class CommunityService {
  private readonly logger = new Logger(CommunityService.name);

  constructor(
    @InjectModel(CommunitySchemaClass.name)
    private communityModel: Model<CommunityDocument>,
    @InjectModel(UserSchemaClass.name) private userModel: Model<UserDocument>,
    @InjectModel(WalletSchemaClass.name) private walletModel: Model<WalletDocument>,
    @InjectConnection() private mongoose: Connection,
    private eventBus: EventBus,
    @Inject(forwardRef(() => UserService))
    private userService: UserService,
    @Inject(forwardRef(() => UserCommunityRoleService))
    private userCommunityRoleService: UserCommunityRoleService,
    @Inject(forwardRef(() => WalletService))
    private walletService: WalletService,
    private communityDefaultsService: CommunityDefaultsService,
  ) {}

  async getCommunity(communityId: string): Promise<Community | null> {
    // Query by internal ID only
    const doc = await this.communityModel.findOne({ id: communityId }).lean();
    return doc ? (doc as unknown as Community) : null;
  }


  /**
   * Get effective permission rules (defaults merged with custom overrides)
   * DB rules override defaults. Rules are matched by role + action.
   */
  getEffectivePermissionRules(community: Community): PermissionRule[] {
    const defaultRules = this.communityDefaultsService.getDefaultPermissionRules(
      community.typeTag,
    );

    if (!community.permissionRules || community.permissionRules.length === 0) {
      return defaultRules;
    }

    // Merge: DB rules override defaults
    // Create a map of default rules by role+action for quick lookup
    const defaultRulesMap = new Map<string, PermissionRule>();
    for (const rule of defaultRules) {
      const key = `${rule.role}:${rule.action}`;
      defaultRulesMap.set(key, rule);
    }

    // Create a map of DB rules by role+action
    const dbRulesMap = new Map<string, PermissionRule>();
    for (const rule of community.permissionRules) {
      const key = `${rule.role}:${rule.action}`;
      dbRulesMap.set(key, rule);
    }

    // Merge: DB rules override defaults, but merge conditions from defaults
    const mergedRules: PermissionRule[] = [];
    const processedKeys = new Set<string>();

    // First, merge DB rules with defaults (DB rules override, but conditions are merged)
    for (const dbRule of community.permissionRules) {
      const key = `${dbRule.role}:${dbRule.action}`;
      const defaultRule = defaultRulesMap.get(key);
      
      // Merge conditions: DB conditions override defaults, but include defaults if not in DB
      const mergedConditions = defaultRule?.conditions
        ? { ...defaultRule.conditions, ...dbRule.conditions }
        : dbRule.conditions;
      
      mergedRules.push({
        ...dbRule,
        conditions: mergedConditions && Object.keys(mergedConditions).length > 0
          ? mergedConditions
          : undefined,
      });
      processedKeys.add(key);
    }

    // Then, add default rules that weren't overridden
    for (const defaultRule of defaultRules) {
      const key = `${defaultRule.role}:${defaultRule.action}`;
      if (!processedKeys.has(key)) {
        mergedRules.push(defaultRule);
      }
    }

    return mergedRules;
  }

  /**
   * Get effective merit settings (defaults merged with custom overrides)
   */
  getEffectiveMeritSettings(community: Community): CommunityMeritSettings {
    const defaults = this.communityDefaultsService.getDefaultMeritSettings(
      community.typeTag,
    );

    if (!community.meritSettings) {
      return defaults;
    }

    const effectiveSettings = {
      ...defaults,
      ...community.meritSettings,
      quotaRecipients:
        community.meritSettings.quotaRecipients ?? defaults.quotaRecipients,
    };

    // If startingMerits is not set, default to dailyQuota value
    if (effectiveSettings.startingMerits === undefined) {
      effectiveSettings.startingMerits = effectiveSettings.dailyQuota;
    }

    return effectiveSettings;
  }

  /**
   * Get effective voting settings (defaults merged with custom overrides)
   */
  getEffectiveVotingSettings(community: Community): CommunityVotingSettings {
    const defaults = this.communityDefaultsService.getDefaultVotingSettings(
      community.typeTag,
    );

    if (!community.votingSettings) {
      return defaults;
    }

    return {
      ...defaults,
      ...community.votingSettings,
      votingRestriction:
        community.votingSettings.votingRestriction ?? defaults.votingRestriction,
      currencySource:
        community.votingSettings.currencySource ?? defaults.currencySource,
      meritConversion:
        community.votingSettings.meritConversion ?? defaults.meritConversion,
    };
  }

  async getCommunityByTypeTag(typeTag: string): Promise<Community | null> {
    const doc = await this.communityModel.findOne({ typeTag }).lean();
    return doc ? (doc as unknown as Community) : null;
  }

  async onModuleInit() {
    await this.ensureBaseCommunities();
    await this.ensureAllUsersInBaseCommunities();
  }

  private async ensureBaseCommunities() {
    this.logger.log('Checking base communities...');

    // 1. Future Vision
    const futureVision = await this.getCommunityByTypeTag('future-vision');
    if (!futureVision) {
      this.logger.log('Creating "Future Vision" community...');
      try {
        await this.createCommunity({
          name: 'Образ Будущего',
          description: 'Группа для публикации и обсуждения образов будущего.',
          typeTag: 'future-vision',
          isPriority: true,
          settings: {
            currencyNames: {
              singular: 'merit',
              plural: 'merits',
              genitive: 'merits',
            },
            dailyEmission: 10,
          },
        });
      } catch (e) {
        this.logger.error('Failed to create Future Vision', e);
      }
    } else if (!futureVision.isPriority) {
      // Update existing community to ensure it's marked as priority
      this.logger.log('Updating "Future Vision" community to set isPriority=true...');
      await this.updateCommunity(futureVision.id, { isPriority: true });
    }

    // 2. Marathon of Good
    const marathon = await this.getCommunityByTypeTag('marathon-of-good');
    if (!marathon) {
      this.logger.log('Creating "Marathon of Good" community...');
      try {
        await this.createCommunity({
          name: 'Марафон Добра',
          description: 'Группа для отчетов о добрых делах.',
          typeTag: 'marathon-of-good',
          isPriority: true,
          settings: {
            currencyNames: {
              singular: 'merit',
              plural: 'merits',
              genitive: 'merits',
            },
            dailyEmission: 10,
          },
        });
      } catch (e) {
        this.logger.error('Failed to create Marathon of Good', e);
      }
    } else if (!marathon.isPriority) {
      // Update existing community to ensure it's marked as priority
      this.logger.log('Updating "Marathon of Good" community to set isPriority=true...');
      await this.updateCommunity(marathon.id, { isPriority: true });
    }

    // 3. Team Projects
    // Check for duplicates first
    const allTeamProjects = await this.communityModel.find({ typeTag: 'team-projects' }).lean();
    if (allTeamProjects.length > 1) {
      this.logger.warn(`Found ${allTeamProjects.length} communities with typeTag 'team-projects'. Removing duplicates...`);
      // Keep the first one (oldest), delete the rest
      const sorted = allTeamProjects.sort((a, b) => {
        const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return aDate - bDate;
      });
      const _toKeep = sorted[0];
      for (let i = 1; i < sorted.length; i++) {
        this.logger.log(`Deleting duplicate Team Projects community: ${sorted[i].id}`);
        await this.communityModel.deleteOne({ id: sorted[i].id });
      }
    }
    
    const teamProjects = await this.getCommunityByTypeTag('team-projects');
    if (!teamProjects) {
      this.logger.log('Creating "Team Projects" community...');
      try {
        await this.createCommunity({
          name: 'Проекты команд',
          description: 'Группа для публикации проектов команд.',
          typeTag: 'team-projects',
          isPriority: true,
          settings: {
            currencyNames: {
              singular: 'merit',
              plural: 'merits',
              genitive: 'merits',
            },
            dailyEmission: 10,
          },
        });
      } catch (e) {
        this.logger.error('Failed to create Team Projects', e);
      }
    } else if (!teamProjects.isPriority) {
      // Update existing community to ensure it's marked as priority
      this.logger.log('Updating "Team Projects" community to set isPriority=true...');
      await this.updateCommunity(teamProjects.id, { isPriority: true });
    }

    // 4. Support
    const support = await this.getCommunityByTypeTag('support');
    if (!support) {
      this.logger.log('Creating "Support" community...');
      try {
        await this.createCommunity({
          name: 'Поддержка',
          description: 'Группа поддержки.',
          typeTag: 'support',
          isPriority: true,
          settings: {
            currencyNames: {
              singular: 'merit',
              plural: 'merits',
              genitive: 'merits',
            },
            dailyEmission: 10,
          },
        });
      } catch (e) {
        this.logger.error('Failed to create Support', e);
      }
    } else if (!support.isPriority) {
      // Update existing community to ensure it's marked as priority
      this.logger.log('Updating "Support" community to set isPriority=true...');
      await this.updateCommunity(support.id, { isPriority: true });
    }
  }

  /**
   * Ensure all users are members of base communities
   * Called on server startup to sync all users to base communities
   */
  private async ensureAllUsersInBaseCommunities(): Promise<void> {
    this.logger.log('Ensuring all users are in base communities...');
    
    try {
      // Get all users (without pagination to process all)
      const allUsers = await this.userModel.find({}).lean();
      this.logger.log(`Found ${allUsers.length} users to check`);
      
      let processedCount = 0;
      let errorsCount = 0;
      
      for (const user of allUsers) {
        try {
          await this.userService.ensureUserInBaseCommunities(user.id);
          processedCount++;
        } catch (error) {
          errorsCount++;
          this.logger.error(
            `Failed to ensure user ${user.id} in base communities: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }
      
      this.logger.log(
        `Base communities sync completed: ${processedCount} users processed, ${errorsCount} errors`
      );
    } catch (error) {
      this.logger.error(
        `Failed to ensure all users in base communities: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async createCommunity(dto: CreateCommunityDto): Promise<Community> {
    // Check for single-instance communities (Future Vision, Marathon of Good, Team Projects, and Support)
    if (dto.typeTag === 'future-vision' || dto.typeTag === 'marathon-of-good' || dto.typeTag === 'team-projects' || dto.typeTag === 'support') {
      const existing = await this.communityModel
        .findOne({ typeTag: dto.typeTag })
        .lean();
      if (existing) {
        throw new BadRequestException(
          `Community with typeTag "${dto.typeTag}" already exists. Only one instance is allowed.`,
        );
      }
    }

    // Defaults are now provided by CommunityDefaultsService at runtime
    // Only store custom overrides if provided in DTO (not implemented yet - always undefined for now)
    const community = {
      id: dto.id || uid(),
      name: dto.name,
      description: dto.description,
      avatarUrl: dto.avatarUrl,
      typeTag: dto.typeTag,
      members: [],
      settings: {
        iconUrl: dto.settings?.iconUrl,
        currencyNames: dto.settings?.currencyNames || {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        },
        dailyEmission: dto.settings?.dailyEmission || 10,
      },
      // Don't store default permission rules - they come from code via CommunityDefaultsService
      // Default meritSettings and votingSettings are also provided by CommunityDefaultsService
      hashtags: [],
      hashtagDescriptions: {},
      isActive: true, // Default to active
      isPriority: dto.isPriority || false, // Default to false
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.communityModel.create([community]);
    this.logger.log(
      `Community created: ${community.id}${dto.typeTag ? ` (typeTag: ${dto.typeTag})` : ''}`,
    );
    return community;
  }

  async updateCommunity(
    communityId: string,
    dto: UpdateCommunityDto,
  ): Promise<Community> {
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.avatarUrl !== undefined) updateData.avatarUrl = dto.avatarUrl;
    if (dto.coverImageUrl !== undefined) updateData.coverImageUrl = dto.coverImageUrl;
    if (dto.hashtags !== undefined) updateData.hashtags = dto.hashtags;
    if (dto.hashtagDescriptions !== undefined) {
      updateData.hashtagDescriptions = dto.hashtagDescriptions;
    }
    if (dto.isPriority !== undefined) updateData.isPriority = dto.isPriority;

    if (dto.settings) {
      // Only merge nested properties if they exist
      const settingsUpdate: any = {};
      if (dto.settings.iconUrl !== undefined)
        settingsUpdate['settings.iconUrl'] = dto.settings.iconUrl;
      if (dto.settings.currencyNames !== undefined) {
        if (dto.settings.currencyNames.singular !== undefined) {
          settingsUpdate['settings.currencyNames.singular'] =
            dto.settings.currencyNames.singular;
        }
        if (dto.settings.currencyNames.plural !== undefined) {
          settingsUpdate['settings.currencyNames.plural'] =
            dto.settings.currencyNames.plural;
        }
        if (dto.settings.currencyNames.genitive !== undefined) {
          settingsUpdate['settings.currencyNames.genitive'] =
            dto.settings.currencyNames.genitive;
        }
      }
      if (dto.settings.dailyEmission !== undefined) {
        settingsUpdate['settings.dailyEmission'] = dto.settings.dailyEmission;
      }
      if (dto.settings.postCost !== undefined) {
        settingsUpdate['settings.postCost'] = dto.settings.postCost;
      }
      if (dto.settings.pollCost !== undefined) {
        settingsUpdate['settings.pollCost'] = dto.settings.pollCost;
      }
      if (dto.settings.forwardCost !== undefined) {
        settingsUpdate['settings.forwardCost'] = dto.settings.forwardCost;
      }
      if (dto.settings.editWindowMinutes !== undefined) {
        settingsUpdate['settings.editWindowMinutes'] = dto.settings.editWindowMinutes;
      }
      if (dto.settings.allowEditByOthers !== undefined) {
        settingsUpdate['settings.allowEditByOthers'] = dto.settings.allowEditByOthers;
      }
      // Explicitly handle canPayPostFromQuota - always update if present (including false)
      if ('canPayPostFromQuota' in dto.settings) {
        settingsUpdate['settings.canPayPostFromQuota'] = Boolean(dto.settings.canPayPostFromQuota);
        this.logger.log(`Updating canPayPostFromQuota to: ${Boolean(dto.settings.canPayPostFromQuota)} for community ${communityId}`);
      }
      // Explicitly handle allowWithdraw - always update if present (including false)
      if ('allowWithdraw' in dto.settings) {
        settingsUpdate['settings.allowWithdraw'] = Boolean(dto.settings.allowWithdraw);
        this.logger.log(`Updating allowWithdraw to: ${Boolean(dto.settings.allowWithdraw)} for community ${communityId}`);
      }
      if (dto.settings.forwardRule !== undefined) {
        settingsUpdate['settings.forwardRule'] = dto.settings.forwardRule;
      }
      if (dto.settings.language !== undefined) {
        settingsUpdate['settings.language'] = dto.settings.language;
      }

      // Merge settings into updateData
      Object.assign(updateData, settingsUpdate);
    }

    if (dto.votingSettings) {
      // Only merge nested properties if they exist
      const votingSettingsUpdate: any = {};
      if (dto.votingSettings.votingRestriction !== undefined) {
        votingSettingsUpdate['votingSettings.votingRestriction'] = dto.votingSettings.votingRestriction;
      }
      if (dto.votingSettings.currencySource !== undefined) {
        votingSettingsUpdate['votingSettings.currencySource'] = dto.votingSettings.currencySource;
      }
      if (dto.votingSettings.spendsMerits !== undefined) {
        votingSettingsUpdate['votingSettings.spendsMerits'] = dto.votingSettings.spendsMerits;
      }
      if (dto.votingSettings.awardsMerits !== undefined) {
        votingSettingsUpdate['votingSettings.awardsMerits'] = dto.votingSettings.awardsMerits;
      }
      if (dto.votingSettings.meritConversion !== undefined) {
        votingSettingsUpdate['votingSettings.meritConversion'] = dto.votingSettings.meritConversion;
      }

      // Merge votingSettings into updateData
      Object.assign(updateData, votingSettingsUpdate);
    }

    if (dto.meritSettings) {
      // Only merge nested properties if they exist
      const meritSettingsUpdate: any = {};
      if (dto.meritSettings.dailyQuota !== undefined) {
        meritSettingsUpdate['meritSettings.dailyQuota'] = dto.meritSettings.dailyQuota;
      }
      if (dto.meritSettings.quotaRecipients !== undefined) {
        meritSettingsUpdate['meritSettings.quotaRecipients'] = dto.meritSettings.quotaRecipients;
      }
      if (dto.meritSettings.canEarn !== undefined) {
        meritSettingsUpdate['meritSettings.canEarn'] = dto.meritSettings.canEarn;
      }
      if (dto.meritSettings.canSpend !== undefined) {
        meritSettingsUpdate['meritSettings.canSpend'] = dto.meritSettings.canSpend;
      }
      if (dto.meritSettings.startingMerits !== undefined) {
        meritSettingsUpdate['meritSettings.startingMerits'] = dto.meritSettings.startingMerits;
      }
      if (dto.meritSettings.quotaEnabled !== undefined) {
        meritSettingsUpdate['meritSettings.quotaEnabled'] = dto.meritSettings.quotaEnabled;
      }

      // Merge meritSettings into updateData
      Object.assign(updateData, meritSettingsUpdate);
    }

    // Handle permissionRules (new system)
    if (dto.permissionRules !== undefined) {
      updateData.permissionRules = dto.permissionRules;
    }

    // Handle legacy rules fields (postingRules, votingRules, visibilityRules, meritRules)
    // These are stored for backward compatibility even though permissionRules is the new system
    if (dto.postingRules !== undefined) {
      updateData.postingRules = dto.postingRules;
    }
    if (dto.votingRules !== undefined) {
      updateData.votingRules = dto.votingRules;
    }
    if (dto.visibilityRules !== undefined) {
      updateData.visibilityRules = dto.visibilityRules;
    }
    if (dto.meritRules !== undefined) {
      updateData.meritRules = dto.meritRules;
    }
    if (dto.linkedCurrencies !== undefined) {
      updateData.linkedCurrencies = dto.linkedCurrencies;
    }

    // Handle tappalkaSettings
    if (dto.tappalkaSettings) {
      const tappalkaSettingsUpdate: any = {};
      if (dto.tappalkaSettings.enabled !== undefined) {
        tappalkaSettingsUpdate['tappalkaSettings.enabled'] = Boolean(dto.tappalkaSettings.enabled);
      }
      if (dto.tappalkaSettings.categories !== undefined) {
        tappalkaSettingsUpdate['tappalkaSettings.categories'] = dto.tappalkaSettings.categories;
      }
      if (dto.tappalkaSettings.winReward !== undefined) {
        tappalkaSettingsUpdate['tappalkaSettings.winReward'] = dto.tappalkaSettings.winReward;
      }
      if (dto.tappalkaSettings.userReward !== undefined) {
        tappalkaSettingsUpdate['tappalkaSettings.userReward'] = dto.tappalkaSettings.userReward;
      }
      if (dto.tappalkaSettings.comparisonsRequired !== undefined) {
        tappalkaSettingsUpdate['tappalkaSettings.comparisonsRequired'] = dto.tappalkaSettings.comparisonsRequired;
      }
      if (dto.tappalkaSettings.showCost !== undefined) {
        tappalkaSettingsUpdate['tappalkaSettings.showCost'] = dto.tappalkaSettings.showCost;
      }
      if (dto.tappalkaSettings.minRating !== undefined) {
        tappalkaSettingsUpdate['tappalkaSettings.minRating'] = dto.tappalkaSettings.minRating;
      }
      if (dto.tappalkaSettings.onboardingText !== undefined) {
        tappalkaSettingsUpdate['tappalkaSettings.onboardingText'] = dto.tappalkaSettings.onboardingText || null;
      }

      // Merge tappalkaSettings into updateData
      Object.assign(updateData, tappalkaSettingsUpdate);
    }

    this.logger.log(`Updating community ${communityId} with data: ${JSON.stringify(updateData)}`);
    
    // Perform the update
    await this.communityModel.updateOne(
      { id: communityId },
      { $set: updateData },
    );

    // Explicitly re-fetch the document to ensure we get the updated values
    const updatedCommunity = await this.communityModel
      .findOne({ id: communityId })
      .lean();

    if (!updatedCommunity) {
      throw new NotFoundException('Community not found');
    }

    this.logger.log(`Updated community ${communityId}, canPayPostFromQuota: ${(updatedCommunity as any).settings?.canPayPostFromQuota}, allowWithdraw: ${(updatedCommunity as any).settings?.allowWithdraw}, full settings: ${JSON.stringify((updatedCommunity as any).settings)}`);
    this.logger.log(`[UPDATE] After save, votingSettings.currencySource: ${(updatedCommunity as any).votingSettings?.currencySource}, full votingSettings: ${JSON.stringify((updatedCommunity as any).votingSettings)}`);

    return (updatedCommunity as unknown) as Community;
  }

  async deleteCommunity(communityId: string): Promise<void> {
    const result = await this.communityModel.deleteOne({ id: communityId });

    if (result.deletedCount === 0) {
      throw new NotFoundException('Community not found');
    }
  }

  async addMember(communityId: string, userId: string): Promise<Community> {
    return MongoArrayUpdateHelper.addToArray<Community>(
      this.communityModel,
      { id: communityId },
      'members',
      userId,
      'Community',
    );
  }

  async removeMember(communityId: string, userId: string): Promise<Community> {
    return MongoArrayUpdateHelper.removeFromArray<Community>(
      this.communityModel,
      { id: communityId },
      'members',
      userId,
      'Community',
    );
  }

  async isUserAdmin(communityId: string, userId: string): Promise<boolean> {
    // 1. Check global superadmin role
    const user = await this.userService.getUserById(userId);
    if (user?.globalRole === GLOBAL_ROLE_SUPERADMIN) {
      return true;
    }

    // 2. Check lead role in community
    const userRole = await this.userCommunityRoleService.getRole(userId, communityId);
    if (userRole?.role === COMMUNITY_ROLE_LEAD) {
      return true;
    }

    return false;
  }

  /**
   * Create a team (local community) by a user
   * User becomes lead of the new team
   */
  async createTeamByUser(
    userId: string,
    data: { name: string; description?: string; avatarUrl?: string },
  ): Promise<Community> {
    this.logger.log(`Creating team by user ${userId}: ${data.name}`);

    // 1. Create community with typeTag 'team'
    const community = await this.createCommunity({
      name: data.name,
      description: data.description,
      avatarUrl: data.avatarUrl,
      typeTag: 'team',
    });

    // 2. Assign creator as lead
    await this.userCommunityRoleService.setRole(userId, community.id, 'lead');

    // 3. Create wallet for user in community
    const currency = community.settings?.currencyNames || {
      singular: 'merit',
      plural: 'merits',
      genitive: 'merits',
    };
    await this.walletService.createOrGetWallet(userId, community.id, currency);

    // 4. Add user to community members list
    await this.addMember(community.id, userId);

    // 5. Add community to user's memberships
    await this.userService.addCommunityMembership(userId, community.id);

    this.logger.log(`Team created: ${community.id} by user ${userId}`);
    return community;
  }

  async isUserMember(communityId: string, userId: string): Promise<boolean> {
    const community = await this.communityModel
      .findOne({
        id: communityId,
        members: userId,
      })
      .lean();
    return community !== null;
  }

  async getAllCommunities(
    limit: number = 50,
    skip: number = 0,
  ): Promise<Community[]> {
    return this.communityModel
      .find({})
      .limit(limit)
      .skip(skip)
      .sort({ isPriority: -1, createdAt: -1 }) // Приоритетные сообщества сначала, затем по дате создания
      .lean() as unknown as Community[];
  }

  async getUserCommunities(userId: string): Promise<Community[]> {
    return this.communityModel
      .find({ members: userId })
      .sort({ isPriority: -1, createdAt: -1 }) // Приоритетные сообщества сначала, затем по дате создания
      .lean() as unknown as Community[];
  }

  async getUserManagedCommunities(userId: string): Promise<Community[]> {
    // Get all community IDs where user has 'lead' role
    const communityIds = await this.userCommunityRoleService.getCommunitiesByRole(
      userId,
      'lead',
    );

    if (communityIds.length === 0) {
      return [];
    }

    // Fetch communities by IDs
    return this.communityModel
      .find({ id: { $in: communityIds } })
      .sort({ createdAt: -1 })
      .lean() as unknown as Community[];
  }

  async addHashtag(communityId: string, hashtag: string): Promise<Community> {
    return MongoArrayUpdateHelper.addToArray<Community>(
      this.communityModel,
      { id: communityId },
      'hashtags',
      hashtag,
      'Community',
    );
  }

  async removeHashtag(
    communityId: string,
    hashtag: string,
  ): Promise<Community> {
    return MongoArrayUpdateHelper.removeFromArray<Community>(
      this.communityModel,
      { id: communityId },
      'hashtags',
      hashtag,
      'Community',
    );
  }

  async updateUserChatMembership(
    chatId: string,
    userId: string,
  ): Promise<boolean> {
    // This is a placeholder for Telegram Bot API integration
    // In a real implementation, this would:
    // 1. Call Telegram Bot API to check if the user is a member of the chat
    // 2. Update the user's community memberships in the database based on the result
    // For now, we'll assume the user is a member
    this.logger.log(`Checking membership: user ${userId} in chat ${chatId}`);
    return true;
  }

  async resetDailyQuota(communityId: string): Promise<{ resetAt: Date }> {
    this.logger.log(`Resetting daily quota for community ${communityId}`);

    // Update lastQuotaResetAt timestamp to current time
    const resetAt = new Date();
    const updatedCommunity = await this.communityModel
      .findOneAndUpdate(
        { id: communityId },
        {
          $set: {
            lastQuotaResetAt: resetAt,
            updatedAt: new Date(),
          },
        },
        { new: true },
      )
      .lean();

    if (!updatedCommunity) {
      throw new NotFoundException('Community not found');
    }

    this.logger.log(
      `Quota reset timestamp updated for community ${communityId} at ${resetAt.toISOString()}`,
    );
    return { resetAt };
  }

  async getCommunityMembers(
    communityId: string,
    limit: number = 50,
    skip: number = 0,
    search?: string,
  ): Promise<{ members: any[]; total: number }> {
    // 1. Get community to retrieve memberIds, settings, and total count
    const community = await this.communityModel
      .findOne({ id: communityId })
      .lean();
    if (!community) {
      throw new NotFoundException('Community not found');
    }

    const memberIds = community.members || [];

    // Build search filter if search query is provided
    const searchFilter: any = { id: { $in: memberIds } };
    if (search && search.trim()) {
      // Escape special regex characters and create case-insensitive regex
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escapedSearch, 'i');
      searchFilter.$or = [
        { username: searchRegex },
        { displayName: searchRegex },
      ];
    }

    if (memberIds.length === 0) {
      return { members: [], total: 0 };
    }

    // Calculate quota start time (needed for quota aggregation)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const quotaStartTime = community.lastQuotaResetAt
      ? new Date(community.lastQuotaResetAt)
      : today;
    
    const dailyQuota = community.settings?.dailyEmission ?? 0;
    const isFutureVision = community.typeTag === 'future-vision';
    const isMarathonOfGood = community.typeTag === 'marathon-of-good';

    // 2. Use aggregation pipeline to join users with roles, wallets, and quota
    // Use $facet to get both filtered results and total count
    const aggregationResult = await this.userModel.aggregate([
      // Match users that are members AND match search criteria (if provided)
      { $match: searchFilter },
      
      // Lookup user community role for this specific community
      {
        $lookup: {
          from: 'user_community_roles',
          let: { userId: '$id', communityId: communityId },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$userId', '$$userId'] },
                    { $eq: ['$communityId', '$$communityId'] },
                  ],
                },
              },
            },
            { $limit: 1 },
          ],
          as: 'roleData',
        },
      },
      
      // Lookup wallet for this user in this community
      {
        $lookup: {
          from: 'wallets',
          let: { userId: '$id', communityId: communityId },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$userId', '$$userId'] },
                    { $eq: ['$communityId', '$$communityId'] },
                  ],
                },
              },
            },
            { $limit: 1 },
          ],
          as: 'walletData',
        },
      },

      // Add community context for quota calculation
      {
        $addFields: {
          userRole: { $arrayElemAt: ['$roleData.role', 0] },
          dailyQuota: dailyQuota,
          quotaStartTime: quotaStartTime,
          isFutureVision: isFutureVision,
          isMarathonOfGood: isMarathonOfGood,
        },
      },

      // Lookup and aggregate quota usage from votes
      {
        $lookup: {
          from: 'votes',
          let: { userId: '$id', communityId: communityId, quotaStartTime: quotaStartTime },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$userId', '$$userId'] },
                    { $eq: ['$communityId', '$$communityId'] },
                    { $gt: ['$amountQuota', 0] },
                    { $gte: ['$createdAt', '$$quotaStartTime'] },
                  ],
                },
              },
            },
            {
              $group: {
                _id: null,
                total: { $sum: '$amountQuota' },
              },
            },
          ],
          as: 'votesQuota',
        },
      },

      // Lookup and aggregate quota usage from poll_casts
      {
        $lookup: {
          from: 'poll_casts',
          let: { userId: '$id', communityId: communityId, quotaStartTime: quotaStartTime },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$userId', '$$userId'] },
                    { $eq: ['$communityId', '$$communityId'] },
                    { $gt: ['$amountQuota', 0] },
                    { $gte: ['$createdAt', '$$quotaStartTime'] },
                  ],
                },
              },
            },
            {
              $group: {
                _id: null,
                total: { $sum: '$amountQuota' },
              },
            },
          ],
          as: 'pollCastsQuota',
        },
      },

      // Lookup and aggregate quota usage from quota_usage
      {
        $lookup: {
          from: 'quota_usage',
          let: { userId: '$id', communityId: communityId, quotaStartTime: quotaStartTime },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$userId', '$$userId'] },
                    { $eq: ['$communityId', '$$communityId'] },
                    { $gt: ['$amountQuota', 0] },
                    { $gte: ['$createdAt', '$$quotaStartTime'] },
                  ],
                },
              },
            },
            {
              $group: {
                _id: null,
                total: { $sum: '$amountQuota' },
              },
            },
          ],
          as: 'quotaUsageQuota',
        },
      },

      // Calculate quota fields
      {
        $addFields: {
          votesTotal: { $ifNull: [{ $arrayElemAt: ['$votesQuota.total', 0] }, 0] },
          pollCastsTotal: { $ifNull: [{ $arrayElemAt: ['$pollCastsQuota.total', 0] }, 0] },
          quotaUsageTotal: { $ifNull: [{ $arrayElemAt: ['$quotaUsageQuota.total', 0] }, 0] },
        },
      },

      {
        $addFields: {
          usedToday: {
            $add: ['$votesTotal', '$pollCastsTotal', '$quotaUsageTotal'],
          },
          // Calculate effective daily quota based on role and community type
          effectiveDailyQuota: {
            $cond: {
              if: {
                $or: [
                  { $eq: ['$isFutureVision', true] },
                  // Note: viewer role removed - all users are now participants
                ],
              },
              then: 0,
              else: '$dailyQuota',
            },
          },
        },
      },

      {
        $addFields: {
          remainingToday: {
            $max: [
              0,
              {
                $subtract: ['$effectiveDailyQuota', '$usedToday'],
              },
            ],
          },
        },
      },

      // Project final structure
      {
        $project: {
          id: 1,
          username: 1,
          displayName: 1,
          avatarUrl: 1,
          globalRole: 1,
          role: '$userRole',
          walletBalance: { $arrayElemAt: ['$walletData.balance', 0] },
          quota: {
            dailyQuota: '$effectiveDailyQuota',
            usedToday: '$usedToday',
            remainingToday: '$remainingToday',
          },
        },
      },
      // Use $facet to get both paginated results and total count
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },
          ],
          totalCount: [
            { $count: 'count' },
          ],
        },
      },
    ]);

    // Extract results and total from facet
    const facetResult = aggregationResult[0] || { data: [], totalCount: [] };
    const members = facetResult.data || [];
    const total = facetResult.totalCount[0]?.count ?? 0;

    // 3. Map to DTO format (handle undefined/null values)
    const mappedMembers = members.map((user: any) => ({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      globalRole: user.globalRole,
      role: user.role || undefined,
      walletBalance: user.walletBalance ?? undefined,
      quota: user.quota
        ? {
            dailyQuota: user.quota.dailyQuota ?? 0,
            usedToday: user.quota.usedToday ?? 0,
            remainingToday: user.quota.remainingToday ?? 0,
          }
        : undefined,
    }));

    return { members: mappedMembers, total };
  }
}
