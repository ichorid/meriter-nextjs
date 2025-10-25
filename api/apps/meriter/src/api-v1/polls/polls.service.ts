import { Injectable, Logger } from '@nestjs/common';
import { PublicationsService } from '../../publications/publications.service';
import { TransactionsService } from '../../transactions/transactions.service';
import { WalletsService } from '../../wallets/wallets.service';
import { TgBotsService } from '../../tg-bots/tg-bots.service';
import { ConfigService } from '@nestjs/config';
import { PaginationHelper, PaginationResult } from '../../common/helpers/pagination.helper';
import { Poll, CreatePollDto, CreatePollVoteDto, PollVote } from '../types/domain.types';
import { uid } from 'uid';
import { encodeTelegramDeepLink } from '../../common/helpers/telegram';

interface PollData {
  title: string;
  description?: string;
  options: Array<{
    id: string;
    text: string;
    votes: number;
    voterCount: number;
  }>;
  expiresAt: string;
  createdAt: string;
  totalVotes: number;
  communityId: string;
}

@Injectable()
export class PollsService {
  private readonly logger = new Logger(PollsService.name);

  constructor(
    private readonly publicationsService: PublicationsService,
    private readonly transactionsService: TransactionsService,
    private readonly walletsService: WalletsService,
    private readonly tgBotsService: TgBotsService,
    private readonly configService: ConfigService,
  ) {}

  async getPolls(pagination: any, filters: any): Promise<PaginationResult<Poll>> {
    const skip = PaginationHelper.getSkip(pagination);
    
    const query: any = { type: 'poll' };
    
    if (filters.communityId) {
      query['meta.origin.telegramChatId'] = filters.communityId;
    }

    const polls = await this.publicationsService.model
      .find(query)
      .skip(skip)
      .limit(pagination.limit)
      .sort({ createdAt: -1 })
      .lean();

    const total = await this.publicationsService.model.countDocuments(query);

    const mappedPolls = polls.map(poll => this.mapToPoll(poll));

    return PaginationHelper.createResult(mappedPolls, total, pagination);
  }

  async getPoll(id: string, userId: string): Promise<Poll | null> {
    const poll = await this.publicationsService.model.findOne({
      uid: id,
      type: 'poll',
    });

    if (!poll) {
      return null;
    }

    // Check if user has access to this poll's community
    const pollData = poll.content as PollData;
    const isMember = await this.tgBotsService.updateUserChatMembership(
      pollData.communityId,
      userId,
    );
    if (!isMember) {
      return null;
    }

    return this.mapToPoll(poll);
  }

  async createPoll(createDto: CreatePollDto, userId: string): Promise<Poll> {
    // Validate input
    if (!createDto.question || createDto.question.trim().length === 0) {
      throw new Error('Question is required');
    }

    if (!createDto.options || createDto.options.length < 2 || createDto.options.length > 10) {
      throw new Error('Poll must have between 2 and 10 options');
    }

    if (!createDto.expiresAt) {
      throw new Error('Expiration date is required');
    }

    const expiresAt = new Date(createDto.expiresAt);
    if (expiresAt <= new Date()) {
      throw new Error('Expiration date must be in the future');
    }

    // Check if user is member of community
    const isMember = await this.tgBotsService.updateUserChatMembership(
      createDto.communityId,
      userId,
    );
    if (!isMember) {
      throw new Error('Not authorized to create polls in this community');
    }

    // Create poll data
    const pollData: PollData = {
      title: createDto.question.trim(),
      description: createDto.description?.trim(),
      options: createDto.options.map((opt) => ({
        id: uid(8),
        text: opt.text,
        votes: 0,
        voterCount: 0,
      })),
      expiresAt: expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
      totalVotes: 0,
      communityId: createDto.communityId,
    };

    // Create publication with type 'poll'
    const now = new Date();
    const pollUid = uid(8);
    
    const publication = await this.publicationsService.model.create({
      type: 'poll',
      content: pollData,
      uid: pollUid,
      createdAt: now,
      updatedAt: now,
      domainName: 'publication',
      meta: {
        author: {
          name: '', // Will be filled by service
          telegramId: userId,
          username: '',
          photoUrl: '',
        },
        origin: {
          telegramChatId: createDto.communityId,
        },
        metrics: {
          plus: 0,
          minus: 0,
          sum: 0,
        },
      },
    });

    // Send Telegram announcement to the community
    try {
      const botUsername = this.configService.get<string>('bot.username') || 'meriter_pro_bot';
      const encodedPollLink = encodeTelegramDeepLink('poll', pollUid);
      const pollLink = `https://t.me/${botUsername}?startapp=${encodedPollLink}`;
      
      const message = `📊 <b>Новый опрос!</b>

<b>${pollData.title}</b>

Голосуйте в приложении Meriter:
${pollLink}`;

      await this.tgBotsService.tgSend({
        tgChatId: createDto.communityId,
        text: message,
      });

      this.logger.log(`📢 Poll announcement sent to Telegram chat ${createDto.communityId} for poll ${pollUid}`);
    } catch (error) {
      this.logger.error(`Failed to send poll announcement to Telegram: ${error.message}`);
    }

    return this.mapToPoll(publication);
  }

  async updatePoll(id: string, updateDto: Partial<CreatePollDto>): Promise<Poll> {
    const poll = await this.publicationsService.model.findOne({
      uid: id,
      type: 'poll',
    });

    if (!poll) {
      throw new Error('Poll not found');
    }

    const pollData = poll.content as PollData;

    // Check if poll is expired
    if (new Date(pollData.expiresAt) <= new Date()) {
      throw new Error('Cannot update expired poll');
    }

    const updateData: any = {};

    if (updateDto.question !== undefined) {
      pollData.title = updateDto.question.trim();
    }
    if (updateDto.description !== undefined) {
      pollData.description = updateDto.description?.trim();
    }
    if (updateDto.expiresAt !== undefined) {
      const expiresAt = new Date(updateDto.expiresAt);
      if (expiresAt <= new Date()) {
        throw new Error('Expiration date must be in the future');
      }
      pollData.expiresAt = expiresAt.toISOString();
    }

    await this.publicationsService.model.updateOne(
      { uid: id },
      { $set: { content: pollData } },
    );

    const updatedPoll = await this.publicationsService.model.findOne({ uid: id });
    return this.mapToPoll(updatedPoll);
  }

  async deletePoll(id: string): Promise<void> {
    const result = await this.publicationsService.model.deleteOne({
      uid: id,
      type: 'poll',
    });

    if (result.deletedCount === 0) {
      throw new Error('Poll not found');
    }
  }

  async createPollVote(pollId: string, createDto: CreatePollVoteDto, userId: string): Promise<PollVote> {
    // Get poll
    const poll = await this.publicationsService.model.findOne({ uid: pollId });
    if (!poll || poll.type !== 'poll') {
      throw new Error('Poll not found');
    }

    const pollData = poll.content as PollData;

    // Check if poll is expired
    if (new Date(pollData.expiresAt) <= new Date()) {
      throw new Error('Poll has expired');
    }

    // Check if user has sufficient balance
    const walletQueryForGet = {
      telegramUserId: userId,
      currencyOfCommunityTgChatId: pollData.communityId,
      domainName: 'wallet',
    };

    const walletValue = await this.walletsService.getValue(walletQueryForGet);
    
    if (walletValue === null || walletValue < createDto.amount) {
      throw new Error(`Insufficient balance. Available: ${walletValue ?? 0}, Required: ${createDto.amount}`);
    }

    // Validate option exists
    const optionIndex = pollData.options.findIndex((opt) => opt.id === createDto.optionId);
    if (optionIndex === -1) {
      throw new Error('Invalid option ID');
    }

    // Deduct amount from wallet
    const walletQueryForDelta = {
      telegramUserId: userId,
      currencyOfCommunityTgChatId: pollData.communityId,
    };
    await this.walletsService.delta(-createDto.amount, walletQueryForDelta);

    // Update poll vote counts
    pollData.options[optionIndex].votes += createDto.amount;
    pollData.options[optionIndex].voterCount += 1;
    pollData.totalVotes += createDto.amount;

    await this.publicationsService.model.updateOne(
      { uid: pollId },
      { $set: { content: pollData } },
    );

    // Create transaction record
    const transaction = await this.transactionsService.model.create({
      type: 'pollVote',
      meta: {
        from: {
          telegramUserId: userId,
          telegramUserName: '',
        },
        amounts: {
          personal: 0,
          free: createDto.amount,
          total: createDto.amount,
          currencyOfCommunityTgChatId: pollData.communityId,
        },
        comment: `Voted on poll: ${pollData.title}`,
        parentPublicationUri: poll.uid,
        metrics: {
          plus: 0,
          minus: 0,
          sum: 0,
        },
      },
      content: {
        optionId: createDto.optionId,
        amount: createDto.amount,
        votedAt: new Date().toISOString(),
      },
    });

    return this.mapToPollVote(transaction);
  }

  async getPollResults(pollId: string, userId: string) {
    const poll = await this.publicationsService.model.findOne({ uid: pollId });
    if (!poll || poll.type !== 'poll') {
      throw new Error('Poll not found');
    }

    const pollData = poll.content as PollData;

    // Check if user has access to this poll's community
    const isMember = await this.tgBotsService.updateUserChatMembership(
      pollData.communityId,
      userId,
    );
    if (!isMember) {
      throw new Error('Not authorized to see this poll');
    }

    // Get all votes for this poll
    const votes = await this.transactionsService.model.find({
      type: 'pollVote',
      'meta.parentPublicationUri': poll.uid,
    });

    // Calculate results
    const results = pollData.options.map(option => ({
      id: option.id,
      text: option.text,
      votes: option.votes,
      voterCount: option.voterCount,
      percentage: pollData.totalVotes > 0 ? (option.votes / pollData.totalVotes) * 100 : 0,
    }));

    return {
      poll: this.mapToPoll(poll),
      results,
      totalVotes: pollData.totalVotes,
      totalVoters: votes.length,
      isExpired: new Date(pollData.expiresAt) <= new Date(),
    };
  }

  async getUserPollVotes(pollId: string, userId: string) {
    const votes = await this.transactionsService.model.find({
      type: 'pollVote',
      'meta.from.telegramUserId': userId,
      'meta.parentPublicationUri': pollId,
    });

    const voteSummary = votes.reduce((acc, vote) => {
      const optionId = vote.content.optionId;
      const amount = vote.content.amount;
      if (!acc[optionId]) {
        acc[optionId] = 0;
      }
      acc[optionId] += amount;
      return acc;
    }, {});

    const totalAmount = votes.reduce((sum, vote) => sum + vote.content.amount, 0);

    return {
      votes: votes.map(v => this.mapToPollVote(v)),
      summary: {
        voteCount: votes.length,
        totalAmount,
        byOption: voteSummary,
      },
    };
  }

  async getCommunityPolls(
    communityId: string,
    pagination: any,
    userId: string,
  ): Promise<PaginationResult<Poll>> {
    const skip = PaginationHelper.getSkip(pagination);

    // Check if user is member of community
    const isMember = await this.tgBotsService.updateUserChatMembership(communityId, userId);
    if (!isMember) {
      throw new Error('Not authorized to see polls in this community');
    }

    const polls = await this.publicationsService.model
      .find({
        type: 'poll',
        'meta.origin.telegramChatId': communityId,
      })
      .skip(skip)
      .limit(pagination.limit)
      .sort({ createdAt: -1 })
      .lean();

    const total = await this.publicationsService.model.countDocuments({
      type: 'poll',
      'meta.origin.telegramChatId': communityId,
    });

    const mappedPolls = polls.map(poll => this.mapToPoll(poll));

    return PaginationHelper.createResult(mappedPolls, total, pagination);
  }

  private mapToPoll(publication: any): Poll {
    const pollData = publication.content as PollData;
    
    return {
      id: publication.uid,
      communityId: pollData.communityId,
      authorId: publication.meta?.author?.telegramId || '',
      question: pollData.title,
      description: pollData.description,
      options: pollData.options,
      expiresAt: pollData.expiresAt,
      isActive: new Date(pollData.expiresAt) > new Date(),
      metrics: {
        totalVotes: pollData.totalVotes,
        voterCount: pollData.options.reduce((sum, opt) => sum + opt.voterCount, 0),
        totalAmount: pollData.totalVotes,
      },
      createdAt: pollData.createdAt,
      updatedAt: publication.updatedAt?.toISOString() || new Date().toISOString(),
    };
  }

  private mapToPollVote(transaction: any): PollVote {
    return {
      id: transaction.uid,
      pollId: transaction.meta?.parentPublicationUri || '',
      optionId: transaction.content?.optionId || '',
      userId: transaction.meta?.from?.telegramUserId || '',
      amount: transaction.content?.amount || 0,
      createdAt: transaction.createdAt?.toISOString() || new Date().toISOString(),
    };
  }
}
