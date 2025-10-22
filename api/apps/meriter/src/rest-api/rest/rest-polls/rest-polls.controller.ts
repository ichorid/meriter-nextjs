import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsString, IsOptional, IsArray, IsNumber, IsNotEmpty, ValidateNested, ArrayMinSize, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';
import { uid } from 'uid';
import { UserGuard } from '../../../user.guard';
import { PublicationsService } from '../../../publications/publications.service';
import { TransactionsService } from '../../../transactions/transactions.service';
import { WalletsService } from '../../../wallets/wallets.service';
import { TgBotsService } from '../../../tg-bots/tg-bots.service';
import { encodeTelegramDeepLink } from '@common/abstracts';

class PollOptionDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  text: string;

  @IsNumber()
  votes: number;

  @IsNumber()
  voterCount: number;
}

interface IPollOption {
  id: string;
  text: string;
  votes: number;
  voterCount: number;
}

interface IPollData {
  title: string;
  description?: string;
  options: IPollOption[];
  expiresAt: string;
  createdAt: string;
  totalVotes: number;
  communityId: string;
}

class CreatePollDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PollOptionDto)
  options: PollOptionDto[];

  @IsString()
  @IsNotEmpty()
  expiresAt: string;

  @IsString()
  @IsNotEmpty()
  communityId: string;
}

class VotePollDto {
  @IsString()
  @IsNotEmpty()
  pollId: string;

  @IsString()
  @IsNotEmpty()
  optionId: string;

  @IsNumber()
  amount: number;
}

@Controller('api/rest/poll')
@UseGuards(UserGuard)
export class RestPollsController {
  private readonly logger = new Logger(RestPollsController.name);

  constructor(
    private publicationsService: PublicationsService,
    private transactionsService: TransactionsService,
    private walletsService: WalletsService,
    private tgBotsService: TgBotsService,
    private configService: ConfigService,
  ) {}

  @Post('create')
  async createPoll(@Body() dto: CreatePollDto, @Req() req) {
    const tgUserId = req.user.tgUserId;
    const name = req.user.tgUserName || req.user.profile?.name || 'User';
    const username = req.user.profile?.username || '';
    const photoUrl = req.user.profile?.avatarUrl || '';

    // Debug logging
    this.logger.log(`Creating poll - User data: tgUserName="${req.user.tgUserName}", profile.name="${req.user.profile?.name}", will use: "${name}"`);


    // Validate input
    if (!dto.title || dto.title.trim().length === 0) {
      throw new HttpException('Title is required', HttpStatus.BAD_REQUEST);
    }

    if (!dto.options || dto.options.length < 2 || dto.options.length > 10) {
      throw new HttpException(
        'Poll must have between 2 and 10 options',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!dto.expiresAt) {
      throw new HttpException('Expiration date is required', HttpStatus.BAD_REQUEST);
    }

    const expiresAt = new Date(dto.expiresAt);
    if (expiresAt <= new Date()) {
      throw new HttpException(
        'Expiration date must be in the future',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Create poll data
    const pollData: IPollData = {
      title: dto.title.trim(),
      description: dto.description?.trim(),
      options: dto.options.map((opt) => ({
        id: opt.id,
        text: opt.text,
        votes: 0,
        voterCount: 0,
      })),
      expiresAt: expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
      totalVotes: 0,
      communityId: dto.communityId,
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
          name: name,
          telegramId: tgUserId,
          username: username,
          photoUrl: photoUrl,
        },
        origin: {
          telegramChatId: dto.communityId,
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

Автор: ${name}

Голосуйте в приложении Meriter:
${pollLink}`;

      await this.tgBotsService.tgSend({
        tgChatId: dto.communityId,
        text: message,
      });

      this.logger.log(`📢 Poll announcement sent to Telegram chat ${dto.communityId} for poll ${pollUid}`);
    } catch (error) {
      // Don't fail poll creation if Telegram message fails
      this.logger.error(`Failed to send poll announcement to Telegram: ${error.message}`);
    }

    return publication;
  }

  @Post('vote')
  async voteOnPoll(@Body() dto: VotePollDto, @Req() req) {
    const tgUserId = req.user.tgUserId;
    const username = req.user.tgUserName || req.user.profile?.name || 'User';

    // Validate input
    if (!dto.pollId || !dto.optionId) {
      throw new HttpException('Poll ID and option ID are required', HttpStatus.BAD_REQUEST);
    }

    if (!dto.amount || dto.amount <= 0) {
      throw new HttpException('Amount must be greater than 0', HttpStatus.BAD_REQUEST);
    }

    // Get poll by uid (not MongoDB _id)
    const poll = await this.publicationsService.model.findOne({ uid: dto.pollId });
    if (!poll || poll.type !== 'poll') {
      throw new HttpException('Poll not found', HttpStatus.NOT_FOUND);
    }

    const pollData = poll.content as IPollData;

    // Check if poll is expired
    if (new Date(pollData.expiresAt) <= new Date()) {
      throw new HttpException('Poll has expired', HttpStatus.BAD_REQUEST);
    }

    // Check if user has sufficient balance
    // getValue uses objectSpreadMeta which adds 'meta.' prefix, so don't include it here
    const walletQueryForGet = {
      telegramUserId: tgUserId,
      currencyOfCommunityTgChatId: pollData.communityId,
      domainName: 'wallet',  // Ensure we're querying the wallet counter, not daily balance
    };

    const walletValue = await this.walletsService.getValue(walletQueryForGet);
    
    if (walletValue === null || walletValue < dto.amount) {
      throw new HttpException(
        `Недостаточно меритов для голосования. Доступно: ${walletValue ?? 0}, требуется: ${dto.amount}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Validate option exists
    const optionIndex = pollData.options.findIndex((opt) => opt.id === dto.optionId);
    if (optionIndex === -1) {
      throw new HttpException('Invalid option ID', HttpStatus.BAD_REQUEST);
    }

    // Deduct amount from wallet (burn it)
    // delta() already sets domainName: 'wallet', so don't include it here
    const walletQueryForDelta = {
      telegramUserId: tgUserId,
      currencyOfCommunityTgChatId: pollData.communityId,
    };
    await this.walletsService.delta(-dto.amount, walletQueryForDelta);

    // Update poll vote counts
    pollData.options[optionIndex].votes += dto.amount;
    pollData.options[optionIndex].voterCount += 1;
    pollData.totalVotes += dto.amount;

    await this.publicationsService.model.updateOne(
      { uid: dto.pollId },
      { $set: { content: pollData } },
    );

    // Create transaction record
    const transaction = await this.transactionsService.model.create({
      type: 'pollVote',
      meta: {
        from: {
          telegramUserId: tgUserId,
          telegramUserName: username,
        },
        amounts: {
          personal: 0,
          free: dto.amount,
          total: dto.amount,
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
        optionId: dto.optionId,
        amount: dto.amount,
        votedAt: new Date().toISOString(),
      },
    });

    // Return updated poll data
    const updatedPoll = await this.publicationsService.model.findOne({ uid: dto.pollId });
    return {
      poll: updatedPoll,
      transaction,
    };
  }

  @Get('get')
  async getPoll(@Query('pollId') pollId: string, @Req() req) {
    const tgUserId = req.user.tgUserId;

    if (!pollId) {
      throw new HttpException('Poll ID is required', HttpStatus.BAD_REQUEST);
    }

    const poll = await this.publicationsService.model.findOne({ uid: pollId });
    if (!poll || poll.type !== 'poll') {
      throw new HttpException('Poll not found', HttpStatus.NOT_FOUND);
    }

    // Get all user votes for this poll
    const userVotes = await this.transactionsService.model.find({
      type: 'pollVote',
      'meta.from.telegramUserId': tgUserId,
      'meta.parentPublicationUri': poll.uid,
    });

    // Calculate total votes per option and overall total
    const voteSummary = userVotes.reduce((acc, vote) => {
      const optionId = vote.content.optionId;
      const amount = vote.content.amount;
      if (!acc[optionId]) {
        acc[optionId] = 0;
      }
      acc[optionId] += amount;
      return acc;
    }, {});

    const totalVoteAmount = userVotes.reduce((sum, vote) => sum + vote.content.amount, 0);

    return {
      poll,
      userVotes: userVotes.map(v => v.content),
      userVoteSummary: {
        voteCount: userVotes.length,
        totalAmount: totalVoteAmount,
        byOption: voteSummary,
      },
    };
  }
}

