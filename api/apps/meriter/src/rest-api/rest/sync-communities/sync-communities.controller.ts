import {
  Controller,
  Post,
  Req,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { UserGuard } from '../../../user.guard';
import { TgChatsService } from '../../../tg-chats/tg-chats.service';
import { TgBotsService } from '../../../tg-bots/tg-bots.service';

@Controller('api/rest/sync-communities')
export class SyncCommunitiesController {
  private readonly logger = new Logger(SyncCommunitiesController.name);

  constructor(
    private tgChatsService: TgChatsService,
    private tgBotsService: TgBotsService,
  ) {}

  @UseGuards(UserGuard)
  @Post()
  async syncCommunities(@Req() req) {
    const telegramId = req.user.tgUserId;
    this.logger.log(`Syncing communities for user ${telegramId}`);
    
    const communities = await this.discoverUserCommunities(telegramId);
    
    this.logger.log(`Sync complete: ${communities.length} communities found for user ${telegramId}`);
    
    return { 
      success: true, 
      count: communities.length,
      communities,
    };
  }

  private async discoverUserCommunities(telegramId: string): Promise<string[]> {
    // Get first 30 registered communities
    const allCommunities = await this.tgChatsService.model
      .find({ domainName: 'tg-chat' })
      .limit(30)
      .lean();

    this.logger.log(`Checking membership in ${allCommunities.length} communities`);

    // Check membership for each in parallel
    const membershipChecks = allCommunities.map(async (community) => {
      const chatId = community.identities?.[0]?.replace('telegram://', '');
      if (!chatId) return null;

      try {
        const isMember = await this.tgBotsService.updateUserChatMembership(
          chatId,
          telegramId,
        );
        return isMember ? chatId : null;
      } catch (error) {
        this.logger.warn(`Failed to check membership for ${chatId}:`, error.message);
        return null;
      }
    });

    const results = await Promise.all(membershipChecks);
    return results.filter((chatId) => chatId !== null);
  }
}

