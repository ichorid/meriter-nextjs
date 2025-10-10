import { Query, Resolver } from '@nestjs/graphql';
import { Publication } from './publications/model/publication.model';

@Resolver()
export class MeriterResolver {
  constructor() {}

  @Query((returns) => Publication)
  async test() {
    return 'test';
  }
}
