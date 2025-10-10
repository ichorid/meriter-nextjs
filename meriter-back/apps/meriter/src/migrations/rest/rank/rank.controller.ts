import { Controller, Get, Param, Query } from '@nestjs/common';
import { TransactionsService } from '../../../transactions/transactions.service';
import { mapUserToOldUser } from '../../schemas/old-user.schema';

class RestRankResponse {
  aggr: { _id: string; rating: number }[];
  rank: { name: string; tgUserId: string; rating: number }[];
  users: { name: string; tgUserId: string }; //no token please!
}

@Controller('api/rest/rank')
export class RestRankController {
  constructor(private readonly transactionsService: TransactionsService) {}
  @Get()
  async rest_rank(@Query('spaceSlug') spaceSlug: string) {
    const rank = await this.transactionsService.rankInHashtag(
      'slug' + spaceSlug,
    );

    return {
      aggr: rank.aggr.map((a) => ({
        _id: a._id?.[0]?.replace('actor.user://telegram', ''),
        rating: a.rating,
      })),
      users: rank.users.map(mapUserToOldUser),
      rank: rank.rank,
    };
  }
}
