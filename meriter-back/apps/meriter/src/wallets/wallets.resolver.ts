import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { WalletsService } from './wallets.service';
import GraphQLJSON from 'graphql-type-json';
import { Wallet } from './model/wallet.model';

@Resolver((of) => Wallet)
export class WalletsResolver {
  constructor(private walletsService: WalletsService) {}
  @Query(() => String)
  sayHello(): string {
    return 'Hello World!';
  }

  @Query(() => String)
  async getWallet(
    @Args('condition', { type: () => GraphQLJSON }) condition,
  ): Promise<number> {
    return this.walletsService.getValue(condition);
  }

  @Mutation(() => String)
  async deltaWallet(
    @Args('delta') delta: number,
    @Args('condition', { type: () => GraphQLJSON })
    condition: Record<string, unknown>,
  ): Promise<string> {
    await this.walletsService.delta(delta, condition);
    return 'Hello World!';
  }
}
