import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectModel, getConnectionToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import type { Connection } from 'mongoose';
import { Model } from 'mongoose';
import { uid } from 'uid';
import * as TelegramTypes from '@common/extapis/telegram/telegram.types';
import type { AppConfig } from '../../config/configuration';
import { FeatureFlagsService } from '../../common/services/feature-flags.service';
import { TgBotsService, TG_BOT_EPHEMERAL_TTL_SEC } from '../../domain/services/tg-bots.service';
import { CommunityService } from '../../domain/services/community.service';
import { UserCommunityRoleService } from '../../domain/services/user-community-role.service';
import { WalletService } from '../../domain/services/wallet.service';
import { PublicationService } from '../../domain/services/publication.service';
import { PermissionService } from '../../domain/services/permission.service';
import { VoteService } from '../../domain/services/vote.service';
import { UserService } from '../../domain/services/user.service';
import { WalletContextResolverService } from '../../domain/services/wallet-context-resolver.service';
import { CommunityWalletService } from '../../domain/services/community-wallet.service';
import { DocumentService } from '../../domain/services/document.service';
import { DocumentVariantService } from '../../domain/services/document-variant.service';
import { TicketService } from '../../domain/services/ticket.service';
import type { Community } from '../../domain/models/community/community.schema';
import {
  CommunitySchemaClass,
  CommunityDocument,
} from '../../domain/models/community/community.schema';
import { UserSchemaClass, UserDocument } from '../../domain/models/user/user.schema';
import {
  TelegramPublicationAnchorSchemaClass,
  TelegramPublicationAnchorDocument,
} from '../../domain/models/telegram/telegram-publication-anchor.schema';
import {
  TelegramBotPendingActionSchemaClass,
  TelegramBotPendingActionDocument,
  type TelegramBotPendingActionType,
} from '../../domain/models/telegram/telegram-bot-pending-action.schema';
import {
  USER_COMMUNITY_ROLE_PERSISTENCE_PORT,
  type UserCommunityRolePersistencePort,
} from '../../domain/ports/user-community-role.persistence.port';
import {
  CREATE_MERIT_TRANSFER_PORT,
  type CreateMeritTransferPort,
} from '../../domain/ports/create-merit-transfer.port';
import { createCreateVoteUseCase } from '../../application/use-cases/voting/create-vote.use-case';
import { GetQuotaUseCase } from '../../application/use-cases/wallets/get-quota.use-case';
import { ResolveTelegramCommunityUseCase } from '../../application/use-cases/communities/resolve-telegram-community.use-case';
import {
  TG_MSG,
  TG_VOTE_DEFAULT_COMMENT,
  buildGroupWelcomeMessage,
  buildOnboardingDoneMessage,
  buildTelegramHelpMessage,
  mapTelegramUserFacingError,
  voteAmountButtonLabels,
} from './telegram-messages.ru';
import {
  normalizeTelegramReactionEmoji,
  reactionTypeKey,
  isTelegramUpvoteEmoji,
  isTelegramHeartEmoji,
  isTelegramDownvoteEmoji,
} from './telegram-reaction-emoji';
import {
  formatTelegramMemberLabel,
  isGenericTelegramMemberDisplayName,
} from './telegram-member-label';
import { getTelegramWebLinkContext } from '../../common/helpers/product-mode.helper';

const LEAD_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
const PENDING_TTL_MS = 15 * 60 * 1000;
const FUTURE_VISION_MAX_LENGTH = 10000;
const BOT_CMD_REGEX =
  /^\/(баланс|balance|участники|members|перевод|transfer|help|справка|settings|настройки)(?:@\w+)?(?:\s+(.*))?$/i;

type BotCommandContext = {
  community: Community;
  userId: string;
  tgUserId: string;
  replyChatId: string;
  message?: Record<string, unknown>;
  triggerMessageId?: number;
  replyInGroup: boolean;
};

type GroupFeedbackContext = {
  groupChatId: string;
  replyToMessageId?: number;
};

type OnboardingPayload = {
  telegramChatId: string;
  chatTitle?: string;
  name?: string;
  futureVisionText?: string;
  quotaEnabled?: boolean;
  dailyEmission?: number;
  hashtag?: string;
  postCost?: number;
  moderation?: boolean;
  telegramPublicationAckEnabled?: boolean;
  welcomeMerits?: number;
};

@Injectable()
export class TelegramBotOrchestratorService {
  private readonly logger = new Logger(TelegramBotOrchestratorService.name);

  constructor(
    private readonly configService: ConfigService<AppConfig>,
    private readonly featureFlags: FeatureFlagsService,
    private readonly tgBots: TgBotsService,
    private readonly communityService: CommunityService,
    private readonly userCommunityRoleService: UserCommunityRoleService,
    private readonly walletService: WalletService,
    private readonly publicationService: PublicationService,
    private readonly permissionService: PermissionService,
    private readonly voteService: VoteService,
    private readonly userService: UserService,
    private readonly walletContextResolver: WalletContextResolverService,
    private readonly communityWalletService: CommunityWalletService,
    private readonly ticketService: TicketService,
    private readonly documentService: DocumentService,
    private readonly documentVariantService: DocumentVariantService,
    @Inject(USER_COMMUNITY_ROLE_PERSISTENCE_PORT)
    private readonly rolePersistence: UserCommunityRolePersistencePort,
    @Inject(CREATE_MERIT_TRANSFER_PORT)
    private readonly createMeritTransfer: CreateMeritTransferPort,
    @Inject(getConnectionToken())
    private readonly connection: Connection,
    @InjectModel(CommunitySchemaClass.name)
    private readonly communityModel: Model<CommunityDocument>,
    @InjectModel(UserSchemaClass.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(TelegramPublicationAnchorSchemaClass.name)
    private readonly anchorModel: Model<TelegramPublicationAnchorDocument>,
    @InjectModel(TelegramBotPendingActionSchemaClass.name)
    private readonly pendingModel: Model<TelegramBotPendingActionDocument>,
  ) {}

  async handleUpdate(body: TelegramTypes.Update): Promise<void> {
    if (!this.featureFlags.isTelegramBotEnabled()) {
      return;
    }

    if (body.my_chat_member) {
      await this.handleMyChatMember(body.my_chat_member);
      return;
    }
    if (body.chat_member) {
      await this.handleChatMember(body.chat_member);
      return;
    }
    if (body.message_reaction) {
      await this.handleMessageReaction(body.message_reaction);
      return;
    }
    if (body.message_reaction_count) {
      await this.handleMessageReactionCount(body.message_reaction_count);
      return;
    }
    if (body.callback_query) {
      await this.handleCallbackQuery(body.callback_query);
      return;
    }
    if (body.message) {
      await this.handleMessage(body.message);
    }
  }

  private async handleMyChatMember(event: Record<string, unknown>): Promise<void> {
    const chat = event.chat as { id: number; title?: string; username?: string };
    const oldMember = event.old_chat_member as { status: string };
    const newMember = event.new_chat_member as { status: string };
    const from = event.from as { id: number; first_name?: string; username?: string };
    const chatId = String(chat.id);
    const oldStatus = oldMember?.status;
    const newStatus = newMember?.status;

    if (
      (oldStatus === 'member' || oldStatus === 'administrator') &&
      (newStatus === 'left' || newStatus === 'kicked')
    ) {
      await this.freezeCommunity(chatId);
      return;
    }

    if (
      (oldStatus === 'left' || oldStatus === 'kicked') &&
      (newStatus === 'member' || newStatus === 'administrator')
    ) {
      const existing = await this.findCommunityByChatId(chatId);
      if (existing?.telegramFrozenAt) {
        await this.communityModel.updateOne(
          { id: existing.id },
          { $set: { telegramFrozenAt: null, updatedAt: new Date() } },
        );
        await this.tgBots.tgSend({
          tgChatId: chatId,
          text: buildGroupWelcomeMessage({
            communityName: existing.name,
            hashtags: existing.hashtags,
          }),
        });
        return;
      }
      if (existing) {
        await this.tgBots.tgSend({
          tgChatId: chatId,
          text: buildGroupWelcomeMessage({
            communityName: existing.name,
            hashtags: existing.hashtags,
          }),
        });
        return;
      }
      await this.startOnboarding(chatId, String(from.id), chat.title);
    }
  }

  private async startOnboarding(
    telegramChatId: string,
    initiatorTgId: string,
    chatTitle?: string,
  ): Promise<void> {
    await this.clearPending(String(initiatorTgId));
    await this.savePending(String(initiatorTgId), 'onboarding_name', {
      telegramChatId,
      chatTitle,
    });
    await this.tgBots.tgSend({
      tgChatId: initiatorTgId,
      text: TG_MSG.onboardingStart,
    });
  }

  private async handleChatMember(event: Record<string, unknown>): Promise<void> {
    const chat = event.chat as { id: number };
    const oldMember = event.old_chat_member as { status: string; user?: { id: number } };
    const newMember = event.new_chat_member as {
      status: string;
      user?: { id: number; first_name?: string; last_name?: string; username?: string };
    };
    const chatId = String(chat.id);
    const community = await this.findCommunityByChatId(chatId);
    if (!community || community.telegramFrozenAt) {
      return;
    }

    const tgUser = newMember?.user ?? oldMember?.user;
    if (!tgUser?.id) {
      return;
    }

    const oldStatus = oldMember?.status;
    const newStatus = newMember?.status;
    const tgUserId = String(tgUser.id);

    if (newStatus === 'member' || newStatus === 'administrator' || newStatus === 'creator') {
      if (oldStatus === 'left' || oldStatus === 'kicked' || oldStatus === 'restricted') {
        await this.provisionMember(community, tgUserId, tgUser as { first_name?: string; last_name?: string; username?: string });
        await this.syncTelegramAdminRole(community, tgUserId, newStatus);
      } else if (newStatus === 'administrator' || newStatus === 'creator') {
        await this.syncTelegramAdminRole(community, tgUserId, newStatus);
      }
      return;
    }

    if (newStatus === 'left' || newStatus === 'kicked') {
      await this.freezeMember(community.id, tgUserId);
    }
  }

  private async handleMessage(message: Record<string, unknown>): Promise<void> {
    const from = message.from as { id: number; first_name?: string; last_name?: string; username?: string };
    const chat = message.chat as { id: number; type?: string; title?: string };
    const text = (message.text as string | undefined) ?? (message.caption as string | undefined);
    const connectedWebsite = message.connected_website;

    if (connectedWebsite || !from || !chat || !text) {
      return;
    }

    const userId = String(from.id);
    const chatId = String(chat.id);

    if (chatId === userId) {
      await this.handleDirectMessage(
        userId,
        text,
        from,
        message.message_id as number | undefined,
      );
      return;
    }

    await this.handleGroupMessage(message, text, userId, chatId, from);
  }

  private async handleDirectMessage(
    tgUserId: string,
    text: string,
    from: { first_name?: string; last_name?: string; username?: string },
    triggerMessageId?: number,
  ): Promise<void> {
    const pending = await this.getPending(tgUserId);
    if (pending) {
      const handled = await this.handlePendingInput(tgUserId, text, pending);
      if (handled) {
        return;
      }
    }

    const trimmed = text.trim();
    if (trimmed.startsWith('/start')) {
      const referal = trimmed.split(/\s+/).slice(1).join(' ').trim();
      if (referal && (referal.includes('auth') || referal === 'community')) {
        await this.tgBots.processRecieveMessageFromUser({
          tgUserId,
          messageText: text,
          tgUserName: [from.first_name, from.last_name].filter(Boolean).join(' '),
        });
        return;
      }
      await this.sendBotEphemeral(tgUserId, await this.helpMessage());
      this.scheduleEphemeralUserMessage(tgUserId, triggerMessageId);
      return;
    }
    if (trimmed === '/help' || trimmed === '/справка') {
      await this.sendBotEphemeral(tgUserId, await this.helpMessage());
      this.scheduleEphemeralUserMessage(tgUserId, triggerMessageId);
      return;
    }

    const amountPending = await this.getPendingByAction(tgUserId, 'confirm_vote_amount');
    if (amountPending && /^\d+([.,]\d+)?$/.test(trimmed.replace(',', '.'))) {
      const amount = parseFloat(trimmed.replace(',', '.'));
      await this.confirmVoteAmount(tgUserId, amountPending.id, amount);
      return;
    }

    const cmdMatch = trimmed.match(BOT_CMD_REGEX);
    if (cmdMatch) {
      await this.handleDirectBotCommand(
        tgUserId,
        from,
        cmdMatch[1].toLowerCase(),
        cmdMatch[2]?.trim() ?? '',
        triggerMessageId,
      );
      return;
    }

    if (/^\/auth\b/i.test(trimmed)) {
      await this.tgBots.processRecieveMessageFromUser({
        tgUserId,
        messageText: text,
        tgUserName: [from.first_name, from.last_name].filter(Boolean).join(' '),
      });
      return;
    }

    await this.tgBots.tgSend({ tgChatId: tgUserId, text: TG_MSG.unknownCommand });
  }

  private async handleGroupMessage(
    message: Record<string, unknown>,
    text: string,
    tgUserId: string,
    chatId: string,
    from: { first_name?: string; last_name?: string; username?: string },
  ): Promise<void> {
    const community = await this.findCommunityByChatId(chatId);
    const trimmedLower = text.trim().toLowerCase();
    const isBotCommand = BOT_CMD_REGEX.test(trimmedLower);
    if (!community) {
      if (isBotCommand || trimmedLower.startsWith('#')) {
        const pending = await this.getPending(tgUserId);
        const hint = pending ? TG_MSG.onboardingInProgress : TG_MSG.groupNotLinked;
        await this.tgBots.tgReplyEphemeral({
          reply_to_message_id: message.message_id as number,
          chat_id: chatId,
          text: hint,
        });
        this.scheduleEphemeralUserMessage(chatId, message.message_id as number);
      }
      return;
    }
    if (community.telegramFrozenAt) {
      if (isBotCommand) {
        await this.tgBots.tgReplyEphemeral({
          reply_to_message_id: message.message_id as number,
          chat_id: chatId,
          text: TG_MSG.communityFrozen,
        });
        this.scheduleEphemeralUserMessage(chatId, message.message_id as number);
      }
      return;
    }

    const user = await this.provisionMember(community, tgUserId, from);
    if (!user) {
      return;
    }
    if (await this.isMemberFrozen(user.id, community.id)) {
      await this.tgBots.tgSend({ tgChatId: tgUserId, text: TG_MSG.frozenMember });
      return;
    }

    const trimmed = trimmedLower;
    const replyTo = message.reply_to_message as
      | { message_id?: number; from?: { id: number; first_name?: string; username?: string } }
      | undefined;

    const transferReplyMatch = trimmed.match(/^\/(перевод|transfer)(?:@\w+)?\s+(\d+(?:[.,]\d+)?)$/i);
    if (transferReplyMatch && replyTo?.from?.id) {
      const amount = parseFloat(transferReplyMatch[2].replace(',', '.'));
      const receiverTgId = String(replyTo.from.id);
      if (receiverTgId !== tgUserId && Number.isFinite(amount) && amount > 0) {
        const receiver = await this.ensureTelegramUser(receiverTgId, replyTo.from);
        await this.executeTransferInGroup(community, user.id, receiver.id, amount, {
          groupChatId: chatId,
          replyToMessageId: message.message_id as number,
        });
        this.scheduleEphemeralUserMessage(chatId, message.message_id as number);
        return;
      }
    }

    if (replyTo?.message_id) {
      const amountPending = await this.pendingModel
        .findOne({
          telegramUserId: tgUserId,
          action: 'confirm_vote_amount',
          'payload.promptMessageId': replyTo.message_id,
        })
        .lean();
      const numericReply = text.trim().match(/^(\d+(?:[.,]\d+)?)$/);
      if (amountPending && numericReply) {
        const amount = parseFloat(numericReply[1].replace(',', '.'));
        await this.confirmVoteAmount(tgUserId, amountPending.id, amount);
        return;
      }
    }

    const cmdMatch = trimmed.match(BOT_CMD_REGEX);
    if (cmdMatch) {
      const cmd = cmdMatch[1].toLowerCase();
      const args = cmdMatch[2]?.trim() ?? '';
      await this.executeBotCommand(
        {
          community,
          userId: user.id,
          tgUserId,
          replyChatId: chatId,
          message,
          replyInGroup: true,
        },
        cmd,
        args,
      );
      return;
    }

    if (replyTo?.message_id) {
      const voteParsed = text.trim().match(/^([+-]?\d+(?:[.,]\d+)?)\s+([\s\S]+)$/);
      if (voteParsed) {
        const amount = Math.abs(parseFloat(voteParsed[1].replace(',', '.')));
        const direction = voteParsed[1].trim().startsWith('-') ? 'down' : 'up';
        const comment = voteParsed[2].trim();
        await this.startReplyVote(user.id, tgUserId, community, replyTo.message_id, amount, direction, comment);
        return;
      }
    }

    await this.tgBots.processRecieveMessageFromGroup({
      tgChatId: chatId,
      tgUserId,
      tgAuthorUsername: from.username,
      tgAuthorName: [from.first_name, from.last_name].filter(Boolean).join(' '),
      messageText: text,
      messageId: message.message_id as number,
      tgChatUsername: (message.chat as { username?: string }).username,
      replyMessageId: replyTo?.message_id,
      tgChatName: (message.chat as { title?: string }).title ?? '',
      firstName: from.first_name,
      lastName: from.last_name,
      entities: message.entities as TelegramTypes.Message['entities'],
    });
  }

  private async handleDirectBotCommand(
    tgUserId: string,
    from: { first_name?: string; last_name?: string; username?: string },
    cmd: string,
    args: string,
    triggerMessageId?: number,
  ): Promise<void> {
    const user = await this.ensureTelegramUser(tgUserId, from);
    const linkedCount = await this.countLinkedTelegramCommunities(user.id);
    if (linkedCount > 1 && !this.configService.get('app')?.defaultTelegramCommunityId?.trim()) {
      await this.tgBots.tgSend({ tgChatId: tgUserId, text: TG_MSG.multipleLinkedCommunities });
      return;
    }

    const resolved = await this.resolveTelegramCommunityForUser(user.id);
    if (!resolved) {
      await this.tgBots.tgSend({ tgChatId: tgUserId, text: TG_MSG.noLinkedCommunity });
      return;
    }

    const community = await this.communityService.getCommunity(resolved.communityId);
    if (!community) {
      await this.tgBots.tgSend({ tgChatId: tgUserId, text: TG_MSG.noLinkedCommunity });
      return;
    }
    if (community.telegramFrozenAt) {
      await this.tgBots.tgSend({ tgChatId: tgUserId, text: TG_MSG.communityFrozen });
      return;
    }

    await this.provisionMember(community, tgUserId, from);
    if (await this.isMemberFrozen(user.id, community.id)) {
      await this.tgBots.tgSend({ tgChatId: tgUserId, text: TG_MSG.frozenMember });
      return;
    }

    await this.executeBotCommand(
      {
        community,
        userId: user.id,
        tgUserId,
        replyChatId: tgUserId,
        triggerMessageId,
        replyInGroup: false,
      },
      cmd,
      args,
    );
  }

  private async executeBotCommand(
    ctx: BotCommandContext,
    cmd: string,
    args: string,
  ): Promise<void> {
    const { community, userId, tgUserId, replyChatId, message, triggerMessageId, replyInGroup } =
      ctx;

    try {
      switch (cmd) {
      case 'баланс':
      case 'balance':
        await this.sendBalance(community, userId, replyChatId, message?.message_id as number | undefined);
        break;
      case 'участники':
      case 'members':
        await this.sendMembers(community, replyChatId, message?.message_id as number | undefined);
        break;
      case 'перевод':
      case 'transfer':
        if (!replyInGroup) {
          await this.tgBots.tgSend({ tgChatId: tgUserId, text: TG_MSG.transferUseGroup });
          break;
        }
        await this.startTransfer(community, userId, tgUserId, args, {
          groupChatId: replyChatId,
          replyToMessageId: message?.message_id as number | undefined,
        });
        break;
      case 'settings':
      case 'настройки':
        if (replyInGroup && message?.message_id) {
          await this.sendSettings(community, userId, replyChatId, message.message_id as number);
        } else {
          await this.tgBots.tgSend({ tgChatId: tgUserId, text: TG_MSG.settingsUseGroup });
        }
        break;
      case 'help':
      case 'справка': {
        const helpText = await this.helpMessage(community.id);
        await this.sendBotEphemeral(
          replyChatId,
          helpText,
          replyInGroup ? (message?.message_id as number | undefined) : undefined,
        );
        break;
      }
      default:
        break;
      }
    } finally {
      const userMessageId =
        (message?.message_id as number | undefined) ?? triggerMessageId;
      this.scheduleEphemeralUserMessage(replyChatId, userMessageId);
    }
  }

  private async resolveTelegramCommunityForUser(userId: string) {
    const useCase = new ResolveTelegramCommunityUseCase({
      userService: this.userService,
      userCommunityRoleService: this.userCommunityRoleService,
      communityModel: this.communityModel,
      configService: this.configService,
    });
    return useCase.execute(userId);
  }

  private async countLinkedTelegramCommunities(userId: string): Promise<number> {
    const user = await this.userService.getUserById(userId);
    if (!user?.communityMemberships?.length) {
      return 0;
    }
    return this.communityModel.countDocuments({
      id: { $in: user.communityMemberships },
      telegramChatId: { $exists: true, $nin: [null, ''] },
      $or: [{ telegramFrozenAt: { $exists: false } }, { telegramFrozenAt: null }],
    });
  }

  private async handleMessageReaction(event: TelegramTypes.MessageReactionUpdated): Promise<void> {
    const chat = event.chat;
    const messageId = event.message_id;
    const user = event.user;
    const newReactions = event.new_reaction ?? [];
    const oldReactions = event.old_reaction ?? [];

    if (!user?.id || !chat?.id) {
      this.logger.warn('message_reaction ignored: missing user or chat', {
        messageId,
        hasUser: Boolean(user?.id),
        hasChat: Boolean(chat?.id),
      });
      return;
    }

    const added = newReactions.filter(
      (nr) => !oldReactions.some((or) => reactionTypeKey(or) === reactionTypeKey(nr)),
    );
    if (added.length === 0) {
      this.logger.debug('message_reaction: no newly added emojis', { messageId, userId: user.id });
      return;
    }

    const chatId = String(chat.id);
    this.logger.log(
      `message_reaction chat=${chatId} message=${messageId} user=${user.id} added=${added.map((r) => r.emoji ?? r.type).join(',')}`,
    );

    const community = await this.findCommunityByChatId(chatId);
    if (!community || community.telegramFrozenAt) {
      this.logger.warn('message_reaction: community missing or frozen', { chatId, messageId });
      return;
    }

    const voter = await this.provisionMember(community, String(user.id), user as { first_name?: string; last_name?: string; username?: string });
    if (!voter || (await this.isMemberFrozen(voter.id, community.id))) {
      await this.tgBots.tgSend({ tgChatId: String(user.id), text: TG_MSG.frozenMember });
      return;
    }

    const anchor = await this.anchorModel
      .findOne({ telegramChatId: chatId, telegramMessageId: messageId })
      .lean();
    if (!anchor) {
      this.logger.warn('message_reaction: no publication anchor', { chatId, messageId });
      await this.tgBots.tgReplyEphemeral({
        chat_id: chatId,
        reply_to_message_id: messageId,
        text: TG_MSG.reactionPostNotFound,
      });
      return;
    }

    const isSelfPost = await this.isSelfPublicationVote(voter.id, anchor.publicationId);
    const groupFeedback: GroupFeedbackContext = { groupChatId: chatId, replyToMessageId: messageId };
    let handled = false;

    for (const reaction of added) {
      if (reaction.type !== 'emoji') {
        this.logger.warn('message_reaction: unsupported reaction type', {
          type: reaction.type,
          messageId,
        });
        continue;
      }
      const emoji = reaction.emoji ?? '';
      if (isTelegramUpvoteEmoji(emoji)) {
        handled = true;
        await this.executeVote(
          voter.id,
          anchor.publicationId,
          1,
          'up',
          undefined,
          String(user.id),
          groupFeedback,
        );
      } else if (isTelegramHeartEmoji(emoji)) {
        handled = true;
        await this.promptVoteAmount(
          voter.id,
          String(user.id),
          anchor.publicationId,
          'up',
          { groupChatId: chatId, replyToMessageId: messageId, isSelfPost },
        );
      } else if (isTelegramDownvoteEmoji(emoji)) {
        handled = true;
        await this.promptVoteAmount(
          voter.id,
          String(user.id),
          anchor.publicationId,
          'down',
          { groupChatId: chatId, replyToMessageId: messageId, isSelfPost },
        );
      } else {
        this.logger.warn('message_reaction: emoji not mapped to vote action', {
          emoji,
          normalized: normalizeTelegramReactionEmoji(emoji),
          messageId,
        });
      }
    }

    if (!handled) {
      await this.tgBots.tgReplyEphemeral({
        chat_id: chatId,
        reply_to_message_id: messageId,
        text: TG_MSG.reactionUnsupported,
      });
    }
  }

  /** Anonymous reaction counts — cannot attribute a vote to a user; log for ops. */
  private async handleMessageReactionCount(
    event: { chat?: { id?: number }; message_id?: number; reactions?: unknown[] },
  ): Promise<void> {
    const chatId = event.chat?.id != null ? String(event.chat.id) : '?';
    this.logger.warn(
      `message_reaction_count chat=${chatId} message=${event.message_id ?? '?'} — anonymous counts cannot create merit votes; ensure bot is group admin and users use non-anonymous reactions`,
    );
  }

  private async handleCallbackQuery(query: Record<string, unknown>): Promise<void> {
    const data = query.data as string | undefined;
    const from = query.from as { id: number };
    const id = query.id as string;
    if (!data || !from?.id) {
      return;
    }

    await this.answerCallback(id);

    const tgUserId = String(from.id);
    const parts = data.split(':');
    if (parts[0] === 'settings' && parts[1] === 'pub_ack' && parts[2] && parts[3]) {
      const enabled = parts[2] === 'on';
      await this.updatePublicationAckSetting(tgUserId, parts[3], enabled);
      return;
    }
    if (parts[0] === 'vote_amt' && parts[1] && parts[2]) {
      const amount = Number.parseInt(parts[2], 10);
      if (Number.isFinite(amount) && amount > 0) {
        await this.confirmVoteAmount(tgUserId, parts[1], amount);
      }
      return;
    }
    if (parts[0] === 'onboard' && (parts[1] === 'yes' || parts[1] === 'no')) {
      const pending = await this.pendingModel.findOne({ telegramUserId: tgUserId }).exec();
      if (pending) {
        await this.handlePendingInput(
          tgUserId,
          parts[1] === 'yes' ? 'да' : 'нет',
          pending,
        );
      }
      return;
    }
    const [kind, action, pendingId] = parts;
    if (kind === 'vote' && pendingId) {
      if (action === 'yes') {
        await this.executePendingVote(tgUserId, pendingId);
      } else {
        await this.pendingModel.deleteOne({ id: pendingId }).exec();
        await this.tgBots.tgSend({ tgChatId: tgUserId, text: TG_MSG.cancelled });
      }
      return;
    }
    if (kind === 'transfer' && pendingId) {
      await this.pendingModel.deleteOne({ id: pendingId }).exec();
      await this.tgBots.tgSend({ tgChatId: tgUserId, text: TG_MSG.cancelled });
    }
  }

  private async handlePendingInput(
    tgUserId: string,
    text: string,
    pending: TelegramBotPendingActionDocument,
  ): Promise<boolean> {
    const payload = (pending.payload ?? {}) as OnboardingPayload;
    const normalized = text.trim().toLowerCase();

    switch (pending.action as TelegramBotPendingActionType) {
      case 'onboarding_name':
        payload.name = text.trim().slice(0, 120);
        await this.advanceOnboarding(
          tgUserId,
          'onboarding_future_vision',
          payload,
          TG_MSG.onboardingFutureVision,
        );
        return true;
      case 'onboarding_future_vision': {
        const vision = text.trim();
        if (!vision) {
          await this.tgBots.tgSend({ tgChatId: tgUserId, text: TG_MSG.onboardingFutureVisionEmpty });
          return true;
        }
        if (vision.length > FUTURE_VISION_MAX_LENGTH) {
          await this.tgBots.tgSend({
            tgChatId: tgUserId,
            text: TG_MSG.onboardingFutureVisionTooLong(FUTURE_VISION_MAX_LENGTH),
          });
          return true;
        }
        payload.futureVisionText = vision;
        await this.advanceOnboarding(tgUserId, 'onboarding_quota_enabled', payload, TG_MSG.onboardingQuota);
        return true;
      }
      case 'onboarding_quota_enabled':
        payload.quotaEnabled = normalized === 'да' || normalized === 'yes';
        if (payload.quotaEnabled) {
          await this.advanceOnboarding(tgUserId, 'onboarding_quota_amount', payload, TG_MSG.onboardingQuotaAmount);
        } else {
          payload.dailyEmission = 0;
          await this.advanceOnboarding(tgUserId, 'onboarding_hashtag', payload, TG_MSG.onboardingHashtag);
        }
        return true;
      case 'onboarding_quota_amount': {
        const n = parseInt(text.trim(), 10);
        payload.dailyEmission = Number.isFinite(n) && n > 0 ? n : 5;
        await this.advanceOnboarding(tgUserId, 'onboarding_hashtag', payload, TG_MSG.onboardingHashtag);
        return true;
      }
      case 'onboarding_hashtag':
        payload.hashtag = text.trim().replace(/^#/, '').slice(0, 32) || 'идея';
        await this.advanceOnboarding(tgUserId, 'onboarding_post_cost', payload, TG_MSG.onboardingPostCost);
        return true;
      case 'onboarding_post_cost': {
        const cost = parseFloat(text.trim().replace(',', '.'));
        payload.postCost = Number.isFinite(cost) && cost >= 0 ? cost : 0;
        await this.advanceOnboarding(tgUserId, 'onboarding_moderation', payload, TG_MSG.onboardingModeration);
        return true;
      }
      case 'onboarding_moderation':
        payload.moderation = normalized === 'да' || normalized === 'yes';
        await this.advanceOnboarding(
          tgUserId,
          'onboarding_publication_ack',
          payload,
          TG_MSG.onboardingPublicationAck,
        );
        return true;
      case 'onboarding_publication_ack':
        payload.telegramPublicationAckEnabled = normalized === 'да' || normalized === 'yes';
        await this.advanceOnboarding(tgUserId, 'onboarding_welcome_merits', payload, TG_MSG.onboardingWelcome);
        return true;
      case 'onboarding_welcome_merits': {
        const w = parseFloat(text.trim().replace(',', '.'));
        payload.welcomeMerits = Number.isFinite(w) && w >= 0 ? w : 0;
        await this.finishOnboarding(tgUserId, payload);
        return true;
      }
      default:
        return false;
    }
  }

  private async advanceOnboarding(
    tgUserId: string,
    nextAction: TelegramBotPendingActionType,
    payload: OnboardingPayload,
    prompt: string,
  ): Promise<void> {
    await this.pendingModel.deleteMany({ telegramUserId: tgUserId }).exec();
    await this.savePending(tgUserId, nextAction, payload as Record<string, unknown>);
    const yesNoSteps: TelegramBotPendingActionType[] = [
      'onboarding_quota_enabled',
      'onboarding_moderation',
      'onboarding_publication_ack',
    ];
    if (yesNoSteps.includes(nextAction)) {
      await this.sendCallbackPrompt(tgUserId, prompt, 'onboard:yes', 'onboard:no');
    } else {
      await this.tgBots.tgSend({ tgChatId: tgUserId, text: prompt });
    }
  }

  private async finishOnboarding(tgUserId: string, payload: OnboardingPayload): Promise<void> {
    const futureVisionText = payload.futureVisionText?.trim() ?? '';
    if (!futureVisionText) {
      await this.tgBots.tgSend({ tgChatId: tgUserId, text: TG_MSG.onboardingFutureVisionEmpty });
      await this.savePending(tgUserId, 'onboarding_future_vision', payload as Record<string, unknown>);
      return;
    }

    await this.clearPending(tgUserId);
    const initiator = await this.ensureTelegramUser(tgUserId, {});
    if (!initiator) {
      return;
    }
    const community = await this.communityService.createCommunity({
      name: payload.name ?? payload.chatTitle ?? 'Telegram-сообщество',
      description: 'Сообщество Meriter Telegram MVP',
      typeTag: 'team',
      futureVisionText,
      creatorUserId: initiator.id,
      settings: {
        currencyNames: { singular: 'заслуга', plural: 'заслуги', genitive: 'заслуг' },
        dailyEmission: payload.quotaEnabled ? (payload.dailyEmission ?? 5) : 0,
        postCost: payload.postCost ?? 0,
        allowWithdraw: false,
      },
    });

    await this.communityService.updateCommunity(community.id, {
      hashtags: [payload.hashtag ?? 'идея'],
      meritSettings: {
        quotaEnabled: payload.quotaEnabled ?? false,
        dailyQuota: payload.dailyEmission ?? 0,
      },
    });

    await this.communityModel.updateOne(
      { id: community.id },
      {
        $set: {
          telegramChatId: payload.telegramChatId,
          'settings.telegramModerationEnabled': payload.moderation ?? false,
          'settings.telegramPublicationAckEnabled': payload.telegramPublicationAckEnabled ?? false,
          'settings.allowWithdraw': false,
          updatedAt: new Date(),
        },
      },
    );

    await this.communityService.addMember(community.id, initiator.id);
    await this.userCommunityRoleService.setRole(initiator.id, community.id, 'lead', true);

    const welcome = payload.welcomeMerits ?? 0;
    if (welcome > 0) {
      const currency = community.settings?.currencyNames ?? {
        singular: 'заслуга',
        plural: 'заслуги',
        genitive: 'заслуг',
      };
      await this.walletService.createOrGetWallet(initiator.id, community.id, currency, {
        startingMeritsIfNewWallet: welcome,
      });
    }

    await this.tgBots.tgSend({
      tgChatId: tgUserId,
      text: buildOnboardingDoneMessage({
        communityName: payload.name ?? community.name,
        hashtags: community.hashtags,
      }),
    });
    await this.tgBots.tgSend({
      tgChatId: payload.telegramChatId,
      text: buildGroupWelcomeMessage({
        communityName: payload.name ?? community.name,
        hashtags: community.hashtags,
      }),
    });
  }

  private async provisionMember(
    community: Community,
    tgUserId: string,
    profile: { first_name?: string; last_name?: string; username?: string },
  ) {
    const user = await this.ensureTelegramUser(tgUserId, profile);
    const role = await this.rolePersistence.findAnyRole(user.id, community.id);
    if (!role) {
      await this.communityService.addMember(community.id, user.id);
      await this.userCommunityRoleService.setRole(user.id, community.id, 'participant', true);
    } else if (role.membershipStatus === 'frozen') {
      await this.rolePersistence.setMembershipStatus(user.id, community.id, 'active', new Date());
    }
    const currency = community.settings?.currencyNames ?? {
      singular: 'заслуга',
      plural: 'заслуги',
      genitive: 'заслуг',
    };
    await this.walletService.createOrGetWallet(user.id, community.id, currency, {
      startingMeritsIfNewWallet: this.communityService.startingMeritsOnJoin(community),
    });
    return user;
  }

  private async ensureTelegramUser(
    tgUserId: string,
    profile: { first_name?: string; last_name?: string; username?: string },
  ): Promise<{ id: string; authProvider: string; authId: string; displayName?: string }> {
    const tgName =
      [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim() ||
      profile.username?.trim() ||
      '';
    const existing = await this.userService.getUserByAuthId('telegram', tgUserId);
    const displayName =
      existing && !isGenericTelegramMemberDisplayName(existing.displayName)
        ? existing.displayName
        : tgName || profile.username || 'Участник';

    const user = await this.userService.findOrCreateByIdentity('telegram', tgUserId, {
      username: profile.username,
      firstName: profile.first_name,
      lastName: profile.last_name,
      displayName,
    });

    if (tgName && isGenericTelegramMemberDisplayName(user.displayName)) {
      await this.userModel.updateOne(
        { id: user.id },
        { $set: { displayName: tgName, updatedAt: new Date() } },
      );
      return {
        id: user.id,
        authProvider: user.authProvider,
        authId: user.authId,
        displayName: tgName,
      };
    }

    return {
      id: user.id,
      authProvider: user.authProvider,
      authId: user.authId,
      displayName: user.displayName,
    };
  }

  private async freezeMember(communityId: string, tgUserId: string): Promise<void> {
    const user = await this.userService.getUserByAuthId('telegram', tgUserId);
    if (!user) {
      return;
    }
    await this.rolePersistence.setMembershipStatus(user.id, communityId, 'frozen', new Date());
  }

  private async freezeCommunity(telegramChatId: string): Promise<void> {
    const community = await this.findCommunityByChatId(telegramChatId);
    if (!community) {
      return;
    }
    await this.communityModel.updateOne(
      { id: community.id },
      { $set: { telegramFrozenAt: new Date(), updatedAt: new Date() } },
    );
    const leads = await this.userCommunityRoleService.getUsersByRole(community.id, 'lead');
    for (const lead of leads) {
      const u = await this.userService.getUserById(lead.userId);
      if (u?.authProvider === 'telegram' && u.authId) {
        await this.tgBots.tgSend({ tgChatId: u.authId, text: TG_MSG.botRemovedAdmin });
      }
    }
  }

  private async syncTelegramAdminRole(
    community: Community,
    tgUserId: string,
    status: string,
  ): Promise<void> {
    const user = await this.ensureTelegramUser(tgUserId, {});
    const isAdmin = status === 'administrator' || status === 'creator';
    const role = await this.rolePersistence.findAnyRole(user.id, community.id);
    if (isAdmin) {
      await this.userCommunityRoleService.setRole(user.id, community.id, 'lead', true);
      await this.rolePersistence.setLeadGraceUntil(user.id, community.id, null, new Date());
      return;
    }
    if (role?.role === 'lead') {
      if (role.leadGraceUntil && role.leadGraceUntil < new Date()) {
        await this.userCommunityRoleService.setRole(user.id, community.id, 'participant', true);
        await this.rolePersistence.setLeadGraceUntil(user.id, community.id, null, new Date());
        return;
      }
      const graceUntil = new Date(Date.now() + LEAD_GRACE_MS);
      await this.rolePersistence.setLeadGraceUntil(user.id, community.id, graceUntil, new Date());
    }
  }

  private async isMemberFrozen(userId: string, communityId: string): Promise<boolean> {
    const role = await this.rolePersistence.findAnyRole(userId, communityId);
    return role?.membershipStatus === 'frozen';
  }

  private async findCommunityByChatId(telegramChatId: string): Promise<Community | null> {
    const doc = await this.communityModel.findOne({ telegramChatId }).lean();
    return doc as Community | null;
  }

  async saveAnchor(
    communityId: string,
    telegramChatId: string,
    telegramMessageId: number,
    publicationId: string,
    anchorType: 'bot_mirror' | 'hashtag',
  ): Promise<void> {
    const now = new Date();
    await this.anchorModel.updateOne(
      { telegramChatId, telegramMessageId },
      {
        $set: {
          communityId,
          publicationId,
          anchorType,
          updatedAt: now,
        },
        $setOnInsert: {
          id: uid(),
          telegramChatId,
          telegramMessageId,
          createdAt: now,
        },
      },
      { upsert: true },
    );
  }

  private async helpMessage(communityId?: string): Promise<string> {
    const { baseUrl, linkStyle } = getTelegramWebLinkContext(this.configService);
    if (!communityId) {
      return buildTelegramHelpMessage(baseUrl, { linkStyle });
    }
    const community = await this.communityService.getCommunity(communityId);
    if (!community) {
      return buildTelegramHelpMessage(baseUrl, { linkStyle });
    }
    return buildTelegramHelpMessage(baseUrl, {
      communityId: community.id,
      communityName: community.name,
      hashtags: community.hashtags,
      linkStyle,
    });
  }

  /** Ephemeral bot reply (auto-deleted after TG_BOT_EPHEMERAL_TTL_SEC). */
  private async sendBotEphemeral(
    chatId: string,
    text: string,
    replyToMessageId?: number,
  ): Promise<number | null> {
    return this.tgBots.tgReplyEphemeral({
      chat_id: chatId,
      text,
      reply_to_message_id: replyToMessageId,
    });
  }

  /** Auto-delete user's bot command after the same TTL as bot replies. */
  private scheduleEphemeralUserMessage(chatId: string, messageId?: number): void {
    if (messageId == null) {
      return;
    }
    this.tgBots.tgScheduleDeleteMessage(chatId, messageId);
  }

  private async answerCallback(callbackQueryId: string): Promise<void> {
    const token = this.configService.get('bot')?.token;
    if (!token || this.configService.get('noAxios')) {
      return;
    }
    try {
      const Axios = (await import('axios')).default;
      const apiUrl = this.configService.get('telegram')?.apiUrl ?? 'https://api.telegram.org';
      await Axios.post(`${apiUrl}/bot${token}/answerCallbackQuery`, {
        callback_query_id: callbackQueryId,
      });
    } catch {
      /* ignore */
    }
  }

  private createVoteUseCase(_voterId: string) {
    return createCreateVoteUseCase({
      publicationService: this.publicationService,
      documentService: this.documentService,
      documentVariantService: this.documentVariantService,
      permissionService: this.permissionService,
      voteService: this.voteService,
      communityService: this.communityService,
      connection: this.connection,
      walletContextResolverService: this.walletContextResolver,
      walletService: this.walletService,
      userService: this.userService,
      userCommunityRoleService: this.userCommunityRoleService,
    });
  }

  private async executeVote(
    voterId: string,
    publicationId: string,
    amount: number,
    direction: 'up' | 'down',
    comment?: string,
    notifyTgId?: string,
    groupFeedback?: GroupFeedbackContext,
  ): Promise<void> {
    try {
      const split = await this.resolveVoteAmountSplit(voterId, publicationId, direction, amount);
      const uc = this.createVoteUseCase(voterId);
      await uc.execute({
        userId: voterId,
        targetType: 'publication',
        targetId: publicationId,
        quotaAmount: split.quotaAmount,
        walletAmount: split.walletAmount,
        direction,
        comment: comment?.trim() ? comment.trim() : TG_VOTE_DEFAULT_COMMENT,
      });
      if (groupFeedback) {
        await this.tgBots.tgReplyEphemeral({
          chat_id: groupFeedback.groupChatId,
          reply_to_message_id: groupFeedback.replyToMessageId,
          text: TG_MSG.voteSuccess(amount, direction),
        });
      }
    } catch (e) {
      const msg =
        e instanceof Error ? mapTelegramUserFacingError(e.message) : TG_MSG.insufficientMerits;
      if (groupFeedback) {
        await this.tgBots.tgReplyEphemeral({
          chat_id: groupFeedback.groupChatId,
          reply_to_message_id: groupFeedback.replyToMessageId,
          text: msg,
        });
      } else if (notifyTgId) {
        await this.tgBots.tgSend({ tgChatId: notifyTgId, text: msg });
      }
      this.logger.warn('executeVote failed', {
        voterId,
        publicationId,
        amount,
        direction,
        error: msg,
      });
    }
  }

  private async resolveVoteAmountSplit(
    voterId: string,
    publicationId: string,
    direction: 'up' | 'down',
    amount: number,
  ): Promise<{ quotaAmount: number; walletAmount: number }> {
    if (direction === 'down') {
      return { quotaAmount: 0, walletAmount: amount };
    }
    const isSelf = await this.isSelfPublicationVote(voterId, publicationId);
    if (isSelf) {
      return { quotaAmount: 0, walletAmount: amount };
    }
    return { quotaAmount: amount, walletAmount: 0 };
  }

  private async isSelfPublicationVote(voterId: string, publicationId: string): Promise<boolean> {
    const publication = await this.publicationService.getPublication(publicationId);
    if (!publication) {
      return false;
    }
    return publication.getAuthorId.getValue() === voterId;
  }

  private async promptVoteAmount(
    voterId: string,
    tgUserId: string,
    publicationId: string,
    direction: 'up' | 'down',
    context?: {
      groupChatId?: string;
      replyToMessageId?: number;
      isSelfPost?: boolean;
    },
  ): Promise<void> {
    const isSelfPost =
      context?.isSelfPost ?? (await this.isSelfPublicationVote(voterId, publicationId));
    const pendingId = uid();

    if (context?.groupChatId && context.replyToMessageId != null) {
      const promptText =
        direction === 'down'
          ? TG_MSG.voteAmountGroupPromptDown
          : isSelfPost
            ? TG_MSG.voteAmountGroupPromptSelf
            : TG_MSG.voteAmountGroupPrompt;
      await this.pendingModel.create({
        id: pendingId,
        telegramUserId: tgUserId,
        action: 'confirm_vote_amount',
        payload: {
          voterId,
          publicationId,
          direction,
          groupChatId: context.groupChatId,
        },
        expiresAt: new Date(Date.now() + PENDING_TTL_MS),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const promptMessageId = await this.sendVoteAmountPromptWithKeyboard(
        context.groupChatId,
        context.replyToMessageId,
        pendingId,
        promptText,
        direction,
      );
      if (promptMessageId != null) {
        await this.pendingModel.updateOne(
          { id: pendingId },
          { $set: { 'payload.promptMessageId': promptMessageId, updatedAt: new Date() } },
        );
        return;
      }
      await this.pendingModel.deleteOne({ id: pendingId }).exec();
    }

    await this.pendingModel.create({
      id: pendingId,
      telegramUserId: tgUserId,
      action: 'confirm_vote_amount',
      payload: { voterId, publicationId, direction },
      expiresAt: new Date(Date.now() + PENDING_TTL_MS),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const dmText =
      direction === 'up' && isSelfPost ? TG_MSG.enterAmountSelfUp : TG_MSG.enterAmount;
    const dmSent = await this.tgBots.tgSend({ tgChatId: tgUserId, text: dmText });
    if (!dmSent) {
      const botUsername = this.configService.get('bot')?.username?.replace(/^@/, '') ?? 'meriterbot';
      await this.tgBots.tgSend({
        tgChatId: tgUserId,
        text: TG_MSG.voteAmountDmFailed(botUsername),
      });
    }
  }

  private async confirmVoteAmount(
    tgUserId: string,
    pendingId: string,
    amount: number,
  ): Promise<void> {
    const pending = await this.pendingModel.findOne({ id: pendingId, telegramUserId: tgUserId }).lean();
    if (!pending) {
      return;
    }
    const payload = pending.payload as {
      voterId: string;
      publicationId: string;
      direction: 'up' | 'down';
      groupChatId?: string;
      promptMessageId?: number;
    };
    await this.pendingModel.deleteOne({ id: pendingId }).exec();
    const groupFeedback = payload.groupChatId
      ? {
          groupChatId: payload.groupChatId,
          replyToMessageId: payload.promptMessageId,
        }
      : undefined;
    await this.executeVote(
      payload.voterId,
      payload.publicationId,
      amount,
      payload.direction,
      undefined,
      tgUserId,
      groupFeedback,
    );
  }

  private async startReplyVote(
    voterId: string,
    tgUserId: string,
    community: Community,
    replyMessageId: number,
    amount: number,
    direction: 'up' | 'down',
    comment: string,
  ): Promise<void> {
    const chatId = community.telegramChatId;
    if (!chatId) {
      return;
    }
    const anchor = await this.anchorModel
      .findOne({ telegramChatId: chatId, telegramMessageId: replyMessageId })
      .lean();
    if (!anchor) {
      await this.tgBots.tgReplyEphemeral({
        chat_id: chatId,
        reply_to_message_id: replyMessageId,
        text: TG_MSG.reactionPostNotFound,
      });
      return;
    }
    await this.executeVote(
      voterId,
      anchor.publicationId,
      amount,
      direction,
      comment,
      tgUserId,
      { groupChatId: chatId, replyToMessageId: replyMessageId },
    );
  }

  private async executePendingVote(tgUserId: string, pendingId: string): Promise<void> {
    const pending = await this.pendingModel.findOne({ id: pendingId, telegramUserId: tgUserId }).lean();
    if (!pending) {
      return;
    }
    const payload = pending.payload as {
      voterId: string;
      publicationId: string;
      direction: 'up' | 'down';
      comment?: string;
      amount?: number;
    };
    await this.pendingModel.deleteOne({ id: pendingId }).exec();
    const amount = payload.amount ?? 1;
    await this.executeVote(
      payload.voterId,
      payload.publicationId,
      amount,
      payload.direction,
      payload.comment,
      tgUserId,
    );
  }

  private buildTelegramMeritTransferInput(
    community: Community,
    senderId: string,
    receiverId: string,
    amount: number,
  ) {
    const walletType = community.isProject ? ('project' as const) : ('community' as const);
    return {
      senderId,
      receiverId,
      amount: Math.floor(amount),
      sourceWalletType: walletType,
      targetWalletType: walletType,
      sourceContextId: community.id,
      targetContextId: community.id,
      communityContextId: community.id,
    };
  }

  private async executeTransferInGroup(
    community: Community,
    senderId: string,
    receiverId: string,
    amount: number,
    group: GroupFeedbackContext,
  ): Promise<void> {
    if (!Number.isFinite(amount) || amount <= 0) {
      await this.tgBots.tgReplyEphemeral({
        chat_id: group.groupChatId,
        reply_to_message_id: group.replyToMessageId,
        text: TG_MSG.transferErrorAmount,
      });
      return;
    }
    if (senderId === receiverId) {
      await this.tgBots.tgReplyEphemeral({
        chat_id: group.groupChatId,
        reply_to_message_id: group.replyToMessageId,
        text: TG_MSG.transferErrorSelf,
      });
      return;
    }
    const receiver = await this.userService.getUserById(receiverId);
    try {
      await this.createMeritTransfer.execute(
        this.buildTelegramMeritTransferInput(community, senderId, receiverId, amount),
      );
      const walletCommunityId = await this.walletContextResolver.resolvePersonalWalletCommunityId(
        community,
        'voting',
      );
      const balance = await this.readWalletBalance(senderId, walletCommunityId);
      await this.tgBots.tgReplyEphemeral({
        chat_id: group.groupChatId,
        reply_to_message_id: group.replyToMessageId,
        text: TG_MSG.transferDoneGroup(
          Math.floor(amount),
          formatTelegramMemberLabel(receiver, receiverId),
          balance,
        ),
      });
    } catch (e) {
      const msg =
        e instanceof Error ? mapTelegramUserFacingError(e.message) : TG_MSG.insufficientMerits;
      await this.tgBots.tgReplyEphemeral({
        chat_id: group.groupChatId,
        reply_to_message_id: group.replyToMessageId,
        text: msg,
      });
    }
  }

  private async startTransfer(
    community: Community,
    senderId: string,
    tgUserId: string,
    args: string,
    group?: GroupFeedbackContext,
  ): Promise<void> {
    if (!group) {
      await this.tgBots.tgSend({ tgChatId: tgUserId, text: TG_MSG.transferUseGroup });
      return;
    }
    const match = args.match(/@?(\w+)\s+(\d+(?:[.,]\d+)?)/);
    if (!match) {
      await this.tgBots.tgReplyEphemeral({
        chat_id: group.groupChatId,
        reply_to_message_id: group.replyToMessageId,
        text: TG_MSG.transferErrorFormat,
      });
      return;
    }
    const username = match[1];
    const amount = parseFloat(match[2].replace(',', '.'));
    const receiver = await this.userModel
      .findOne({
        $or: [{ username }, { displayName: new RegExp(`^${username}$`, 'i') }],
      })
      .lean();
    if (!receiver) {
      await this.tgBots.tgReplyEphemeral({
        chat_id: group.groupChatId,
        reply_to_message_id: group.replyToMessageId,
        text: TG_MSG.transferErrorReceiver,
      });
      return;
    }
    await this.executeTransferInGroup(community, senderId, receiver.id, amount, group);
  }

  private async sendSettings(
    community: Community,
    userId: string,
    chatId: string,
    replyToMessageId: number,
  ): Promise<void> {
    const role = await this.userCommunityRoleService.getRole(userId, community.id);
    if (role?.role !== 'lead') {
      await this.tgBots.tgReplyEphemeral({
        chat_id: chatId,
        reply_to_message_id: replyToMessageId,
        text: TG_MSG.settingsLeadOnly,
      });
      return;
    }
    const ackEnabled = community.settings?.telegramPublicationAckEnabled ?? false;
    await this.sendSettingsPrompt(chatId, replyToMessageId, community.id, ackEnabled);
  }

  private async sendSettingsPrompt(
    chatId: string,
    replyToMessageId: number,
    communityId: string,
    ackEnabled: boolean,
  ): Promise<void> {
    const token = this.configService.get('bot')?.token;
    if (!token || this.configService.get('noAxios')) {
      await this.sendBotEphemeral(chatId, TG_MSG.settingsLead(ackEnabled), replyToMessageId);
      return;
    }
    try {
      const Axios = (await import('axios')).default;
      const apiUrl = this.configService.get('telegram')?.apiUrl ?? 'https://api.telegram.org';
      const res = await Axios.post(`${apiUrl}/bot${token}/sendMessage`, {
        chat_id: chatId,
        reply_to_message_id: replyToMessageId,
        text: TG_MSG.settingsLead(ackEnabled),
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: ackEnabled ? '✓ Уведомлять о постах' : 'Уведомлять о постах',
                callback_data: `settings:pub_ack:on:${communityId}`,
              },
              {
                text: !ackEnabled ? '✓ Без уведомлений' : 'Без уведомлений',
                callback_data: `settings:pub_ack:off:${communityId}`,
              },
            ],
          ],
        },
      });
      const messageId = res.data?.result?.message_id;
      if (typeof messageId === 'number') {
        setTimeout(() => {
          void this.tgBots.tgDeleteMessage(chatId, messageId);
        }, TG_BOT_EPHEMERAL_TTL_SEC * 1000);
      }
    } catch {
      await this.sendBotEphemeral(chatId, TG_MSG.settingsLead(ackEnabled), replyToMessageId);
    }
  }

  private async updatePublicationAckSetting(
    tgUserId: string,
    communityId: string,
    enabled: boolean,
  ): Promise<void> {
    const user = await this.userService.getUserByAuthId('telegram', tgUserId);
    if (!user) {
      return;
    }
    const role = await this.userCommunityRoleService.getRole(user.id, communityId);
    if (role?.role !== 'lead') {
      await this.tgBots.tgSend({ tgChatId: tgUserId, text: TG_MSG.settingsLeadOnly });
      return;
    }
    await this.communityModel.updateOne(
      { id: communityId },
      { $set: { 'settings.telegramPublicationAckEnabled': enabled, updatedAt: new Date() } },
    );
    await this.tgBots.tgSend({ tgChatId: tgUserId, text: TG_MSG.settingsAckUpdated(enabled) });
  }

  private async sendVoteAmountPromptWithKeyboard(
    chatId: string,
    replyToMessageId: number,
    pendingId: string,
    promptText: string,
    direction: 'up' | 'down',
  ): Promise<number | null> {
    const token = this.configService.get('bot')?.token;
    if (!token || this.configService.get('noAxios')) {
      return this.tgBots.tgReplyEphemeral({
        chat_id: chatId,
        reply_to_message_id: replyToMessageId,
        text: promptText,
      });
    }
    const [l1, l2, l3] = voteAmountButtonLabels(direction);
    try {
      const Axios = (await import('axios')).default;
      const apiUrl = this.configService.get('telegram')?.apiUrl ?? 'https://api.telegram.org';
      const res = await Axios.post(`${apiUrl}/bot${token}/sendMessage`, {
        chat_id: chatId,
        reply_to_message_id: replyToMessageId,
        text: promptText,
        reply_markup: {
          inline_keyboard: [
            [
              { text: l1, callback_data: `vote_amt:${pendingId}:1` },
              { text: l2, callback_data: `vote_amt:${pendingId}:3` },
              { text: l3, callback_data: `vote_amt:${pendingId}:5` },
            ],
          ],
        },
      });
      const messageId = res.data?.result?.message_id;
      if (typeof messageId === 'number') {
        setTimeout(() => {
          void this.tgBots.tgDeleteMessage(chatId, messageId);
        }, TG_BOT_EPHEMERAL_TTL_SEC * 1000);
        return messageId;
      }
    } catch {
      /* fallback below */
    }
    return this.tgBots.tgReplyEphemeral({
      chat_id: chatId,
      reply_to_message_id: replyToMessageId,
      text: promptText,
    });
  }

  private async sendCallbackPrompt(
    tgUserId: string,
    text: string,
    yesData: string,
    noData: string,
  ): Promise<void> {
    const token = this.configService.get('bot')?.token;
    if (!token || this.configService.get('noAxios')) {
      await this.tgBots.tgSend({ tgChatId: tgUserId, text: `${text} (ответьте «да» или «нет»)` });
      return;
    }
    try {
      const Axios = (await import('axios')).default;
      const apiUrl = this.configService.get('telegram')?.apiUrl ?? 'https://api.telegram.org';
      await Axios.post(`${apiUrl}/bot${token}/sendMessage`, {
        chat_id: tgUserId,
        text,
        reply_markup: {
          inline_keyboard: [[
            { text: 'Да', callback_data: yesData },
            { text: 'Нет', callback_data: noData },
          ]],
        },
      });
    } catch {
      await this.tgBots.tgSend({ tgChatId: tgUserId, text });
    }
  }

  private async sendBalance(
    community: Community,
    userId: string,
    chatId: string,
    replyTo?: number,
  ): Promise<void> {
    const { wallet, pct, quota, quotaMax } = await this.getMemberStats(community, userId);
    const text = TG_MSG.balanceSelf(community.name, wallet, quota, quotaMax, pct);
    await this.sendBotEphemeral(chatId, text, replyTo);
  }

  private async readWalletBalance(userId: string, walletCommunityId: string): Promise<number> {
    const w = await this.walletService.getWallet(userId, walletCommunityId);
    return w?.getBalance() ?? 0;
  }

  private async sendMembers(community: Community, chatId: string, replyTo?: number): Promise<void> {
    const memberIds = await this.rolePersistence.distinctActiveMemberUserIds(community.id);
    const sliceIds = memberIds.slice(0, 30);
    const lines: string[] = [TG_MSG.membersHeader];
    const wallets: number[] = [];
    const walletCommunityId = await this.walletContextResolver.resolvePersonalWalletCommunityId(
      community,
      'voting',
    );
    for (const memberId of sliceIds) {
      const bal = await this.readWalletBalance(memberId, walletCommunityId);
      wallets.push(bal);
    }
    const users = await this.userModel
      .find({ id: { $in: sliceIds } })
      .select({ id: 1, displayName: 1, username: 1, firstName: 1, lastName: 1 })
      .lean();
    const userById = new Map(users.map((u) => [u.id, u]));
    const total = wallets.reduce((a, b) => a + b, 0) || 1;
    for (let i = 0; i < sliceIds.length; i++) {
      const memberId = sliceIds[i];
      const pct = (wallets[i] / total) * 100;
      const label = formatTelegramMemberLabel(userById.get(memberId), memberId);
      lines.push(TG_MSG.memberLine(label, wallets[i], pct));
    }
    await this.sendBotEphemeral(chatId, lines.join('\n'), replyTo);
  }

  private async getMemberStats(community: Community, userId: string) {
    const walletCommunityId = await this.walletContextResolver.resolvePersonalWalletCommunityId(
      community,
      'voting',
    );
    const wallet = await this.readWalletBalance(userId, walletCommunityId);
    const quotaUc = new GetQuotaUseCase(this.communityService, this.permissionService, this.connection);
    let quota = 0;
    let quotaMax = 0;
    try {
      const q = await quotaUc.getQuota({ viewerId: userId, userId, communityId: community.id });
      quota = q.remaining;
      quotaMax = q.dailyQuota;
    } catch {
      /* quota disabled */
    }
    const memberIds = await this.rolePersistence.distinctActiveMemberUserIds(community.id);
    let total = 0;
    for (const mid of memberIds) {
      total += await this.readWalletBalance(mid, walletCommunityId);
    }
    const pct = total > 0 ? (wallet / total) * 100 : 0;
    return { wallet, quota, quotaMax, pct };
  }

  private async savePending(
    tgUserId: string,
    action: TelegramBotPendingActionType,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const now = new Date();
    await this.pendingModel.create({
      id: uid(),
      telegramUserId: tgUserId,
      action,
      payload,
      expiresAt: new Date(now.getTime() + PENDING_TTL_MS),
      createdAt: now,
      updatedAt: now,
    });
  }

  private async getPending(tgUserId: string) {
    return this.pendingModel
      .findOne({ telegramUserId: tgUserId, expiresAt: { $gt: new Date() } })
      .sort({ createdAt: -1 })
      .exec();
  }

  private async getPendingByAction(tgUserId: string, action: TelegramBotPendingActionType) {
    return this.pendingModel
      .findOne({ telegramUserId: tgUserId, action, expiresAt: { $gt: new Date() } })
      .lean();
  }

  private async clearPending(tgUserId: string): Promise<void> {
    await this.pendingModel.deleteMany({ telegramUserId: tgUserId }).exec();
  }
}
