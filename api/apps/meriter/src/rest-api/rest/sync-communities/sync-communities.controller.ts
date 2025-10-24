import { Controller, Post, Req, UseGuards, Logger } from '@nestjs/common';
import { TgBotsService } from '../../../tg-bots/tg-bots.service';
import { TgChatsService } from '../../../tg-chats/tg-chats.service';
import { UserGuard } from '../../../user.guard';

class SyncCommunitiesResponse {
  success: boolean;
  message: string;
  communitiesChecked: number;
  membershipsUpdated: number;
  errors: string[];
}

@Controller('api/rest/sync-communities')
export class SyncCommunitiesController {
  private readonly logger = new Logger(SyncCommunitiesController.name);

  constructor(
    private readonly tgBotsService: TgBotsService,
    private readonly tgChatsService: TgChatsService,
  ) {}

  @UseGuards(UserGuard)
  @Post()
  async syncCommunities(@Req() req): Promise<SyncCommunitiesResponse> {
    const tgUserId = req.user.tgUserId;
    const userTags = req.user.chatsIds || [];
    
    this.logger.log(`🔄 Starting community sync for user ${tgUserId}`);
    this.logger.log(`📋 User current tags: [${userTags.join(', ')}]`);
    
    if (!tgUserId) {
      const errorMsg = 'No Telegram user ID found in request';
      this.logger.error(`❌ ${errorMsg}`);
      return {
        success: false,
        message: errorMsg,
        communitiesChecked: 0,
        membershipsUpdated: 0,
        errors: [errorMsg],
      };
    }

    const errors: string[] = [];
    let membershipsUpdated = 0;
    let communitiesChecked = 0;

    try {
      // Get all communities where the user has tags
      const communities = await this.tgChatsService.model.find({
        identities: { $in: userTags.map(tag => `telegram://${tag}`) },
        domainName: 'tg-chat',
      });

      this.logger.log(`🔍 Found ${communities.length} communities to check`);

      // Check membership for each community
      for (const community of communities) {
        const chatId = community.identities?.[0]?.replace('telegram://', '');
        if (!chatId) {
          errors.push(`Invalid chat ID for community ${community.uid}`);
          continue;
        }

        communitiesChecked++;
        
        try {
          this.logger.log(`🔍 Checking membership for chat ${chatId}`);
          const isMember = await this.tgBotsService.updateUserChatMembership(chatId, tgUserId);
          
          if (isMember) {
            membershipsUpdated++;
            this.logger.log(`✅ Membership confirmed for chat ${chatId}`);
          } else {
            this.logger.log(`❌ User is not a member of chat ${chatId}`);
          }
        } catch (error) {
          const errorMsg = `Failed to check membership for chat ${chatId}: ${error.message}`;
          errors.push(errorMsg);
          this.logger.warn(`⚠️  ${errorMsg}`);
        }
      }

      // Also check if user is member of any communities not in their tags
      this.logger.log(`🔍 Checking for communities not in user tags...`);
      const allCommunities = await this.tgChatsService.model.find({
        domainName: 'tg-chat',
        'meta.botRemoved': { $ne: true }, // Exclude communities where bot was removed
      }).limit(50); // Limit to prevent excessive API calls

      for (const community of allCommunities) {
        const chatId = community.identities?.[0]?.replace('telegram://', '');
        if (!chatId || userTags.includes(chatId)) {
          continue; // Skip invalid chat IDs or already tagged communities
        }

        try {
          const isMember = await this.tgBotsService.updateUserChatMembership(chatId, tgUserId);
          if (isMember) {
            membershipsUpdated++;
            this.logger.log(`✅ Found new membership for chat ${chatId}`);
          }
        } catch (error) {
          // Silently skip errors for communities not in user tags
          this.logger.debug(`Skipping chat ${chatId}: ${error.message}`);
        }
      }

      const message = `Sync completed: ${membershipsUpdated} memberships updated, ${communitiesChecked} communities checked`;
      this.logger.log(`✅ ${message}`);

      return {
        success: true,
        message,
        communitiesChecked,
        membershipsUpdated,
        errors,
      };

    } catch (error) {
      const errorMsg = `Sync failed: ${error.message}`;
      this.logger.error(`❌ ${errorMsg}`);
      
      return {
        success: false,
        message: errorMsg,
        communitiesChecked,
        membershipsUpdated,
        errors: [...errors, errorMsg],
      };
    }
  }
}