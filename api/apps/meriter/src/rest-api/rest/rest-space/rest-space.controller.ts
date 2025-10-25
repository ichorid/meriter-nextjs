import { Controller, Get, Query } from '@nestjs/common';
import { HashtagsService } from '../../../hashtags/hashtags.service';
import { successResponse } from '../utils/response.helper';


@Controller('api/rest/space')
export class RestSpaceController {
  constructor(private readonly hashtagsService: HashtagsService) {}

  @Get()
  async rest_space(@Query('spaceSlug') spaceSlug: string) {
    const hashtag = await this.hashtagsService.model.findOne({
      slug: spaceSlug,
    });
    return successResponse({ space: hashtag });
  }
}
