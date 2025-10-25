import { Controller, Get, Param, Query } from '@nestjs/common';
import { TransactionsService } from '../../../transactions/transactions.service';
import { successResponse } from '../utils/response.helper';


@Controller('api/rest/rank')
export class RestRankController {
  constructor(private readonly transactionsService: TransactionsService) {}
  @Get()
  async rest_rank(@Query('spaceSlug') spaceSlug: string) {
    const rank = await this.transactionsService.rankInHashtag(
      'slug' + spaceSlug,
    );

    return successResponse({
      aggr: rank.aggr.map((a) => ({
        _id: a._id?.[0]?.replace('actor.user://telegram', ''),
        rating: a.rating,
      })),
      users: rank.users,
      rank: rank.rank,
    });
  }
}
