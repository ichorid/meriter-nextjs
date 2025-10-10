import { Controller, Get, Query } from '@nestjs/common';
import { HashtagsService } from '../../../hashtags/hashtags.service';

// Helper function to map hashtag to old space format for API backward compatibility
function mapHashtagToOldFormat(hashtag: any) {
  if (!hashtag) return null;
  return {
    chatId: hashtag.meta?.parentTgChatId,
    name: hashtag.profile?.name,
    tagRus: hashtag.profile?.name,
    slug: hashtag.slug,
    description: hashtag.profile?.description,
    rating: 0,
    deleted: hashtag.deleted ?? false,
    dimensionConfig: hashtag.meta?.dimensionConfig,
  };
}

@Controller('api/rest/space')
export class RestSpaceController {
  constructor(private readonly hashtagsService: HashtagsService) {}

  @Get()
  async rest_space(@Query('spaceSlug') spaceSlug: string) {
    const hashtag = await this.hashtagsService.model.findOne({
      slug: spaceSlug,
    });
    return { space: mapHashtagToOldFormat(hashtag) };
  }
}
