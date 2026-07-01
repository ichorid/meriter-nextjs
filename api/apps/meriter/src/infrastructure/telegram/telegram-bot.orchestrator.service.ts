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
import { createCreateVoteUseCase } from '../../application/use-cases/voting/create-vote.use-case';
import { GetQuotaUseCase } from '../../application/use-cases/wallets/get-quota.use-case';
import { ResolveTelegramCommunityUseCase } from '../../application/use-cases/communities/resolve-telegram-community.use-case';
import {
  TG_MSG,
  TG_VOTE_DEFAULT_COMMENT,
  buildGroupWelcomeMessage,
  buildNewMemberWelcomeMessage,
  resolveNewMemberGreetingName,
  buildTelegramMiniAppStartLink,
  buildTelegramBotOpenKeyboard,
  TG_BOT_OPEN_BUTTON_LABELS,
  type TelegramInlineReplyMarkup,
  buildOnboardingDoneMessage,
  buildTelegramHelpMessage,
  getOnboardingPrompt,
  getSettingsEditPrompt,
  buildSettingsLeadSummary,
  buildSettingsEditKeyboard,
  communitySettingsSnapshot,
  settingsEditFieldToAction,
  isSettingsEditField,
  primaryCommunityHashtag,
  buildTelegramVoterDisplayName,
  buildVoteAmountGroupMentionMessage,
  buildVoteAmountGroupNumericMentionMessage,
  formatVoteAmountBalanceHint,
  type SettingsEditField,
  mapTelegramUserFacingError,
  voteAmountButtonLabels,
  type CommunityUsageRulesInput,
} from './telegram-messages.ru';
import { buildTelegramGuideMessage } from './telegram-guide.ru';
import {
  normalizeTelegramReactionEmoji,
  reactionTypeKey,
  isTelegramUpvoteEmoji,
  isTelegramHeartEmoji,
  isTelegramDownvoteEmoji,
  isTelegramVoteReaction,
} from './telegram-reaction-emoji';
import {
  formatTelegramMemberLabel,
  isGenericTelegramMemberDisplayName,
} from './telegram-member-label';
import { TELEGRAM_ONBOARDING_PLATFORM_INTEGRATION_STEP_ENABLED } from './telegram-onboarding-flow';
import {
  resolveTelegramCommandDelivery,
  cycleTelegramCommandDelivery,
  commandRoutingFromOnboardingPreset,
  parseOnboardingCommandDeliveryInput,
  formatTelegramCommandDeliveryLabel,
  type TelegramRoutableCommand,
  type TelegramCommandDelivery,
  type TelegramCommandRoutingSettings,
} from './telegram-command-routing';
import {
  buildVotePanelMessageText,
  buildVotePanelKeyboard,
  parseVotePanelCallback,
} from './telegram-vote-panel';
import { resolvePublicationVoteBlockReason } from './telegram-publication-vote-block';
import {
  parseVoteAmountReply,
  resolveVoteAmountDirection,
} from './telegram-vote-amount-parse';

const LEAD_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
const PENDING_TTL_MS = 15 * 60 * 1000;
const FUTURE_VISION_MAX_LENGTH = 10000;
const BOT_CMD_REGEX =
  /^\/(баланс|balance|участники|members|help|справка|settings|настройки|guide|гайд|linkandpin|link)(?:@\w+)?(?:\s+(.*))?$/i;
const GROUP_START_CMD_REGEX = /^\/start(?:@\w+)?(?:\s|$)/i;

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
  platformIntegration?: boolean;
  platformVisibility?: 'private' | 'public';
  futureVisionText?: string;
  quotaEnabled?: boolean;
  dailyEmission?: number;
  hashtag?: string;
  postCost?: number;
  moderation?: boolean;
  telegramPublicationAckEnabled?: boolean;
  welcomeMerits?: number;
  votePanelEnabled?: boolean;
  newMemberWelcomeEnabled?: boolean;
  telegramCommandRouting?: TelegramCommandRoutingSettings;
};

@Injectable()
export class TelegramBotOrchestratorService {
  private readonly logger = new Logger(TelegramBotOrchestratorService.name);
  private readonly votePanelRefreshTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

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
      (oldStatus === 'left' || oldStatus === 'kicked') &&
      (newStatus === 'member' || newStatus === 'administrator')
    ) {
      await this.tgBots.syncTelegramChatAdministrators(chatId);
    }

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
        await this.sendGroupWelcome(chatId, this.buildCommunityUsageInput(existing), existing.id);
        return;
      }
      if (existing) {
        await this.sendGroupWelcome(chatId, this.buildCommunityUsageInput(existing), existing.id);
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
      text: getOnboardingPrompt('onboarding_name', {}),
    });
  }

  private async handleChatMember(event: Record<string, unknown>): Promise<void> {
    const chat = event.chat as { id: number };
    const oldMember = event.old_chat_member as { status: string; user?: { id: number } };
    const newMember = event.new_chat_member as {
      status: string;
      user?: {
        id: number;
        is_bot?: boolean;
        first_name?: string;
        last_name?: string;
        username?: string;
      };
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
        if (newMember.user?.is_bot === true) {
          return;
        }
        await this.tgBots.recordTelegramChatMember(chatId, tgUser, 'chat_member');
        await this.provisionMember(community, tgUserId, tgUser as { first_name?: string; last_name?: string; username?: string });
        await this.syncTelegramAdminRole(community, tgUserId, newStatus);
        await this.sendNewMemberWelcomeIfEnabled(
          community,
          chatId,
          tgUser as { first_name?: string; last_name?: string },
        );
      } else if (newStatus === 'administrator' || newStatus === 'creator') {
        await this.tgBots.recordTelegramChatMember(chatId, tgUser, 'chat_member');
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

    if (connectedWebsite || !chat) {
      return;
    }

    const chatId = String(chat.id);
    await this.indexTelegramMessageMembers(message, chatId);

    if (!from || !text) {
      return;
    }

    const userId = String(from.id);

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

  private async indexTelegramMessageMembers(
    message: Record<string, unknown>,
    chatId: string,
  ): Promise<void> {
    const chat = message.chat as { type?: string } | undefined;
    if (chat?.type === 'private') {
      return;
    }

    const from = message.from as
      | {
          id: number;
          username?: string;
          first_name?: string;
          last_name?: string;
          is_bot?: boolean;
        }
      | undefined;
    if (from?.id && !from.is_bot) {
      await this.tgBots.recordTelegramChatMember(chatId, from, 'message');
    }

    const newMembers = message.new_chat_members as
      | Array<{
          id: number;
          username?: string;
          first_name?: string;
          last_name?: string;
          is_bot?: boolean;
        }>
      | undefined;
    if (newMembers?.length) {
      for (const member of newMembers) {
        if (member?.id && !member.is_bot) {
          await this.tgBots.recordTelegramChatMember(chatId, member, 'new_chat_members');
        }
      }
    }

    const entities = (message.entities ?? message.caption_entities) as
      | Array<{
          type: string;
          user?: {
            id: number;
            username?: string;
            first_name?: string;
            last_name?: string;
            is_bot?: boolean;
          };
        }>
      | undefined;
    if (entities?.length) {
      for (const entity of entities) {
        if (entity.type === 'text_mention' && entity.user?.id && !entity.user.is_bot) {
          await this.tgBots.recordTelegramChatMember(chatId, entity.user, 'text_mention');
        }
      }
    }

    const replyTo = message.reply_to_message as
      | {
          from?: {
            id: number;
            username?: string;
            first_name?: string;
            last_name?: string;
            is_bot?: boolean;
          };
        }
      | undefined;
    if (replyTo?.from?.id && !replyTo.from.is_bot) {
      await this.tgBots.recordTelegramChatMember(chatId, replyTo.from, 'reply');
    }
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
      const primaryCommunityBefore = await this.resolvePrimaryTelegramCommunityForUser(tgUserId);
      const isReturning = primaryCommunityBefore
        ? await this.isReturningMeriterMember(tgUserId, primaryCommunityBefore.id)
        : Boolean(await this.userService.getUserByAuthId('telegram', tgUserId));
      await this.provisionLinkedTelegramCommunities(tgUserId, from);
      if (referal === 'guide') {
        await this.handleDirectBotCommand(tgUserId, from, 'guide', '', triggerMessageId);
        return;
      }
      if (referal === 'vote') {
        await this.tgBots.tgSend({ tgChatId: tgUserId, text: TG_MSG.voteStartAfterOpen });
        this.scheduleEphemeralUserMessage(tgUserId, triggerMessageId);
        return;
      }
      const primaryCommunity = await this.resolvePrimaryTelegramCommunityForUser(tgUserId);
      await this.sendBotEphemeral(
        tgUserId,
        await this.helpMessage(primaryCommunity?.id, {
          forStart: true,
          isReturning,
          tgUserId,
        }),
      );
      this.scheduleEphemeralUserMessage(tgUserId, triggerMessageId);
      return;
    }
    if (trimmed === '/help' || trimmed === '/справка') {
      await this.sendBotEphemeral(tgUserId, await this.helpMessage());
      this.scheduleEphemeralUserMessage(tgUserId, triggerMessageId);
      return;
    }
    if (trimmed === '/guide' || trimmed === '/гайд') {
      await this.handleDirectBotCommand(tgUserId, from, 'guide', '', triggerMessageId);
      return;
    }

    const amountPending = await this.getPendingByAction(tgUserId, 'confirm_vote_amount');
    if (amountPending) {
      const parsed = parseVoteAmountReply(text);
      if (parsed.ok) {
        const payload = amountPending.payload as { direction: 'up' | 'down' };
        const resolved = resolveVoteAmountDirection(payload.direction, parsed.explicitDirection);
        await this.confirmVoteAmount(tgUserId, amountPending.id, parsed.amount, {
          directionOverride: resolved.direction,
          directionFlippedNotice:
            resolved.flipped && parsed.explicitDirection != null
              ? parsed.explicitDirection
              : undefined,
        });
        this.scheduleEphemeralUserMessage(tgUserId, triggerMessageId);
        return;
      }
      await this.sendVoteAmountRetryPrompt(tgUserId, amountPending.id, triggerMessageId);
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

    const trimmed = trimmedLower;
    const startPayload = GROUP_START_CMD_REGEX.test(text.trim())
      ? text.trim().split(/\s+/).slice(1).join(' ').trim()
      : '';
    const isBareGroupStart =
      GROUP_START_CMD_REGEX.test(text.trim()) &&
      (!startPayload || (!startPayload.includes('auth') && startPayload !== 'community'));
    const isReturningBeforeProvision = isBareGroupStart
      ? await this.isReturningMeriterMember(tgUserId, community.id)
      : false;

    const user = await this.provisionMember(community, tgUserId, from);
    if (!user) {
      return;
    }
    if (await this.isMemberFrozen(user.id, community.id)) {
      await this.tgBots.tgSend({ tgChatId: tgUserId, text: TG_MSG.frozenMember });
      return;
    }

    if (isBareGroupStart) {
      await this.sendBotEphemeral(
        chatId,
        await this.helpMessage(community.id, {
          forStart: true,
          isReturning: isReturningBeforeProvision,
        }),
        message.message_id as number,
      );
      this.scheduleEphemeralUserMessage(chatId, message.message_id as number);
      return;
    }

    const replyTo = message.reply_to_message as
      | { message_id?: number; from?: { id: number; first_name?: string; username?: string } }
      | undefined;

    if (replyTo?.message_id) {
      const amountPending = await this.pendingModel
        .findOne({
          telegramUserId: tgUserId,
          action: 'confirm_vote_amount',
          'payload.promptMessageId': replyTo.message_id,
        })
        .lean();
      if (amountPending) {
        const parsed = parseVoteAmountReply(text);
        if (parsed.ok) {
          const payload = amountPending.payload as { direction: 'up' | 'down' };
          const resolved = resolveVoteAmountDirection(payload.direction, parsed.explicitDirection);
          await this.confirmVoteAmount(tgUserId, amountPending.id, parsed.amount, {
            ephemeralUserReply: {
              chatId,
              messageId: message.message_id as number,
            },
            directionOverride: resolved.direction,
            directionFlippedNotice:
              resolved.flipped && parsed.explicitDirection != null
                ? parsed.explicitDirection
                : undefined,
          });
          return;
        }
        await this.sendVoteAmountRetryPrompt(
          chatId,
          amountPending.id,
          message.message_id as number,
        );
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

    if (replyTo?.message_id && community.settings?.telegramVotePanelEnabled !== true) {
      const voteParsed = text.trim().match(/^([+-]?\d+(?:[.,]\d+)?)\s+([\s\S]+)$/);
      if (voteParsed) {
        const amount = Math.abs(parseFloat(voteParsed[1].replace(',', '.')));
        const direction = voteParsed[1].trim().startsWith('-') ? 'down' : 'up';
        const comment = voteParsed[2].trim();
        await this.startReplyVote(user.id, tgUserId, community, replyTo.message_id, amount, direction, comment);
        return;
      }
    }

    if (replyTo?.from?.id && !replyTo.from.is_bot) {
      await this.provisionMember(community, String(replyTo.from.id), {
        first_name: replyTo.from.first_name,
        last_name: (replyTo.from as { last_name?: string }).last_name,
        username: replyTo.from.username,
      });
    }

    const publishResult = await this.tgBots.processRecieveMessageFromGroup({
      tgChatId: chatId,
      tgUserId,
      tgAuthorUsername: from.username,
      tgAuthorName: [from.first_name, from.last_name].filter(Boolean).join(' '),
      messageText: text,
      messageId: message.message_id as number,
      tgChatUsername: (message.chat as { username?: string }).username,
      replyMessageId: replyTo?.message_id,
      replyToFrom: replyTo?.from
        ? {
            id: replyTo.from.id,
            is_bot: (replyTo.from as { is_bot?: boolean }).is_bot,
            first_name: replyTo.from.first_name,
            last_name: (replyTo.from as { last_name?: string }).last_name,
            username: replyTo.from.username,
          }
        : undefined,
      tgChatName: (message.chat as { title?: string }).title ?? '',
      firstName: from.first_name,
      lastName: from.last_name,
      entities: message.entities as TelegramTypes.Message['entities'],
    });

    if (
      publishResult &&
      community.settings?.telegramVotePanelEnabled === true
    ) {
      await this.createVotePanelForPublication(
        community,
        publishResult.publicationId,
        publishResult.hashtagMessageId,
      );
    }
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
    _args: string,
  ): Promise<void> {
    const { community, userId, tgUserId, replyChatId, message, triggerMessageId, replyInGroup } =
      ctx;

    try {
      switch (cmd) {
      case 'баланс':
      case 'balance': {
        const delivery = resolveTelegramCommandDelivery(
          community.settings?.telegramCommandRouting,
          'balance',
        );
        await this.deliverRoutedCommand(ctx, delivery, async () => {
          const { wallet, pct, quota, quotaMax } = await this.getMemberStats(community, userId);
          return TG_MSG.balanceSelf(community.name, wallet, quota, quotaMax, pct);
        });
        break;
      }
      case 'участники':
      case 'members': {
        const delivery = resolveTelegramCommandDelivery(
          community.settings?.telegramCommandRouting,
          'members',
        );
        await this.deliverRoutedCommand(ctx, delivery, async () => {
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
          return lines.join('\n');
        });
        break;
      }
      case 'settings':
      case 'настройки': {
        const role = await this.userCommunityRoleService.getRole(userId, community.id);
        if (role?.role !== 'lead') {
          const leadOnlyText = TG_MSG.settingsLeadOnly;
          if (replyInGroup && message?.message_id) {
            await this.tgBots.tgReplyEphemeral({
              chat_id: replyChatId,
              reply_to_message_id: message.message_id as number,
              text: leadOnlyText,
            });
          } else {
            await this.tgBots.tgSend({ tgChatId: tgUserId, text: leadOnlyText });
          }
          break;
        }
        const sent = await this.sendSettingsToUser(tgUserId, community);
        if (replyInGroup && message?.message_id) {
          const replyTo = message.message_id as number;
          if (sent) {
            await this.sendBotEphemeral(replyChatId, TG_MSG.commandAnswerInDm, replyTo);
            this.scheduleEphemeralUserMessage(replyChatId, replyTo);
          } else {
            const botUsername =
              this.configService.get('bot')?.username?.replace(/^@/, '') ?? 'meriterbot';
            await this.sendBotOpenHint(replyChatId, botUsername, 'settings', replyTo);
            this.scheduleEphemeralUserMessage(replyChatId, replyTo);
          }
        } else if (!sent) {
          const botUsername =
            this.configService.get('bot')?.username?.replace(/^@/, '') ?? 'meriterbot';
          await this.tgBots.tgSend({
            tgChatId: tgUserId,
            text: TG_MSG.settingsDmFailed(botUsername),
          });
        }
        break;
      }
      case 'help':
      case 'справка': {
        const delivery = resolveTelegramCommandDelivery(
          community.settings?.telegramCommandRouting,
          'help',
        );
        await this.deliverRoutedCommand(ctx, delivery, () => this.helpMessage(community.id));
        break;
      }
      case 'guide':
      case 'гайд': {
        const sent = await this.sendGuideToUser(tgUserId, community);
        if (replyInGroup && message?.message_id) {
          const replyTo = message.message_id as number;
          if (sent) {
            await this.sendBotEphemeral(replyChatId, TG_MSG.commandAnswerInDm, replyTo);
          } else {
            const botUsername =
              this.configService.get('bot')?.username?.replace(/^@/, '') ?? 'meriterbot';
            await this.sendBotOpenHint(replyChatId, botUsername, 'guide', replyTo);
          }
        } else if (!sent) {
          const botUsername =
            this.configService.get('bot')?.username?.replace(/^@/, '') ?? 'meriterbot';
          await this.tgBots.tgSend({
            tgChatId: tgUserId,
            text: TG_MSG.guideDmFailed(botUsername),
          });
        }
        break;
      }
      case 'linkandpin':
        await this.sendMiniAppLink(community, replyChatId, {
          pin: true,
          replyToMessageId: replyInGroup
            ? (message?.message_id as number | undefined)
            : undefined,
        });
        break;
      case 'link': {
        const delivery = resolveTelegramCommandDelivery(
          community.settings?.telegramCommandRouting,
          'link',
        );
        if (delivery.destination === 'dm') {
          await this.deliverRoutedCommand(ctx, delivery, () => '', {
            onDm: async () => {
              await this.sendMiniAppLinkToDm(community, tgUserId);
            },
          });
        } else if (delivery.ephemeral) {
          await this.deliverRoutedCommand(ctx, delivery, async () => {
            const botUsername = this.configService.get('bot')?.username?.replace(/^@/, '').trim();
            if (!botUsername) {
              return TG_MSG.miniAppLinkUnavailable;
            }
            return `${TG_MSG.groupMiniAppLinkHint}\n\n${buildTelegramMiniAppStartLink(botUsername, community.id)}`;
          });
        } else {
          await this.sendMiniAppLink(community, replyChatId, {
            pin: false,
            replyToMessageId: replyInGroup
              ? (message?.message_id as number | undefined)
              : undefined,
          });
        }
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

    const chatId = String(chat.id);
    await this.tgBots.recordTelegramChatMember(chatId, user, 'message');

    const added = newReactions.filter(
      (nr) => !oldReactions.some((or) => reactionTypeKey(or) === reactionTypeKey(nr)),
    );
    const voteAdded = added.filter((reaction) => isTelegramVoteReaction(reaction));
    if (voteAdded.length === 0) {
      return;
    }

    this.logger.log(
      `message_reaction chat=${chatId} message=${messageId} user=${user.id} added=${voteAdded.map((r) => r.emoji ?? r.type).join(',')}`,
    );

    const community = await this.findCommunityByChatId(chatId);
    if (!community || community.telegramFrozenAt) {
      this.logger.warn('message_reaction: community missing or frozen', { chatId, messageId });
      return;
    }
    if (community.settings?.telegramVotePanelEnabled === true) {
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
      if (community.settings?.telegramReactionNoHashtagHintEnabled !== false) {
        await this.tgBots.tgReplyEphemeral({
          chat_id: chatId,
          reply_to_message_id: messageId,
          text: TG_MSG.reactionPostNotFound(primaryCommunityHashtag(community.hashtags)),
        });
      }
      return;
    }

    const voteBlockReason = await this.getPublicationVoteBlockReason(voter.id, anchor.publicationId);
    const groupFeedback: GroupFeedbackContext = { groupChatId: chatId, replyToMessageId: messageId };

    for (const reaction of voteAdded) {
      const emoji = reaction.emoji ?? '';
      if (voteBlockReason) {
        await this.tgBots.tgReplyEphemeral({
          chat_id: chatId,
          reply_to_message_id: messageId,
          text:
            voteBlockReason === 'beneficiary'
              ? TG_MSG.cannotVoteAsBeneficiary
              : TG_MSG.cannotVoteOwnPost,
        });
        continue;
      }
      if (isTelegramUpvoteEmoji(emoji)) {
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
        await this.promptVoteAmount(
          community,
          voter.id,
          String(user.id),
          anchor.publicationId,
          'up',
          {
            groupChatId: chatId,
            replyToMessageId: messageId,
            voterFirstName: (user as { first_name?: string }).first_name,
            voterLastName: (user as { last_name?: string }).last_name,
            voterUsername: (user as { username?: string }).username,
          },
        );
      } else if (isTelegramDownvoteEmoji(emoji)) {
        await this.promptVoteAmount(
          community,
          voter.id,
          String(user.id),
          anchor.publicationId,
          'down',
          {
            groupChatId: chatId,
            replyToMessageId: messageId,
            voterFirstName: (user as { first_name?: string }).first_name,
            voterLastName: (user as { last_name?: string }).last_name,
            voterUsername: (user as { username?: string }).username,
          },
        );
      } else {
        this.logger.debug('message_reaction: vote emoji not mapped', {
          emoji,
          normalized: normalizeTelegramReactionEmoji(emoji),
          messageId,
        });
      }
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
    const from = query.from as {
      id: number;
      username?: string;
      first_name?: string;
      last_name?: string;
      is_bot?: boolean;
    };
    const message = query.message as { chat?: { id: number; type?: string } } | undefined;
    const id = query.id as string;
    if (!data || !from?.id) {
      return;
    }

    const chatId = message?.chat?.id != null ? String(message.chat.id) : undefined;
    if (chatId && message?.chat?.type !== 'private') {
      await this.tgBots.recordTelegramChatMember(chatId, from, 'message');
    }

    const tgUserId = String(from.id);
    const parts = data.split(':');
    if (
      parts[0] === 'settings' &&
      parts[1] === 'toggle' &&
      parts[2] === 'vote_panel' &&
      parts[3]
    ) {
      const toast = await this.toggleVotePanel(tgUserId, parts[3]);
      await this.answerCallback(id, toast);
      return;
    }
    if (
      parts[0] === 'settings' &&
      parts[1] === 'cmd_route' &&
      parts[2] &&
      parts[3]
    ) {
      const toast = await this.cycleCommandRoute(
        tgUserId,
        parts[3],
        parts[2] as TelegramRoutableCommand,
      );
      await this.answerCallback(id, toast);
      return;
    }
    if (
      parts[0] === 'settings' &&
      parts[1] === 'toggle' &&
      parts[2] === 'vote_success_ephemeral' &&
      parts[3]
    ) {
      const toast = await this.toggleVoteSuccessEphemeral(tgUserId, parts[3]);
      await this.answerCallback(id, toast);
      return;
    }
    if (
      parts[0] === 'settings' &&
      parts[1] === 'toggle' &&
      parts[2] === 'reaction_no_hashtag' &&
      parts[3]
    ) {
      const toast = await this.toggleReactionNoHashtagHint(tgUserId, parts[3]);
      await this.answerCallback(id, toast);
      return;
    }
    if (
      parts[0] === 'settings' &&
      parts[1] === 'toggle' &&
      parts[2] === 'new_member_welcome' &&
      parts[3]
    ) {
      const toast = await this.toggleNewMemberWelcome(tgUserId, parts[3]);
      await this.answerCallback(id, toast);
      return;
    }

    await this.answerCallback(id);

    const votePanelParsed = parseVotePanelCallback(data);
    if (votePanelParsed) {
      await this.handleVotePanelCallback(tgUserId, votePanelParsed, query);
      return;
    }

    if (parts[0] === 'settings' && parts[1] === 'edit' && parts[2] && parts[3]) {
      if (isSettingsEditField(parts[2])) {
        await this.beginSettingsEdit(tgUserId, parts[3], parts[2]);
      }
      return;
    }
    if (parts[0] === 'vote_amt' && parts[1] && parts[2]) {
      const amount = Number.parseInt(parts[2], 10);
      if (Number.isFinite(amount) && amount > 0) {
        await this.handleVoteAmountCallback(tgUserId, parts[1], amount, query);
      }
      return;
    }
    if (
      parts[0] === 'onboard' &&
      parts[1] === 'cmd_del' &&
      (parts[2] === 'group_ephemeral' ||
        parts[2] === 'group_permanent' ||
        parts[2] === 'dm')
    ) {
      const pending = await this.pendingModel.findOne({ telegramUserId: tgUserId }).exec();
      if (pending?.action === 'onboarding_command_delivery') {
        const payload = (pending.payload ?? {}) as OnboardingPayload;
        payload.telegramCommandRouting = commandRoutingFromOnboardingPreset(
          parts[2] as 'group_ephemeral' | 'group_permanent' | 'dm',
        );
        await this.finishOnboarding(tgUserId, payload);
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
    if (
      parts[0] === 'onboard' &&
      parts[1] === 'vis' &&
      (parts[2] === 'private' || parts[2] === 'public')
    ) {
      const pending = await this.pendingModel.findOne({ telegramUserId: tgUserId }).exec();
      if (pending) {
        await this.handlePendingInput(tgUserId, parts[2], pending);
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
        if (!TELEGRAM_ONBOARDING_PLATFORM_INTEGRATION_STEP_ENABLED) {
          payload.platformIntegration = false;
          await this.advanceOnboarding(tgUserId, 'onboarding_quota_enabled', payload);
        } else {
          await this.advanceOnboarding(tgUserId, 'onboarding_platform_integration', payload);
        }
        return true;
      case 'onboarding_platform_integration':
        if (!TELEGRAM_ONBOARDING_PLATFORM_INTEGRATION_STEP_ENABLED) {
          payload.platformIntegration = false;
          await this.advanceOnboarding(tgUserId, 'onboarding_quota_enabled', payload);
          return true;
        }
        payload.platformIntegration = normalized === 'да' || normalized === 'yes';
        if (payload.platformIntegration) {
          await this.advanceOnboardingVisibility(tgUserId, payload);
        } else {
          await this.advanceOnboarding(tgUserId, 'onboarding_quota_enabled', payload);
        }
        return true;
      case 'onboarding_platform_visibility':
        payload.platformVisibility =
          normalized === 'public' || normalized === 'публичное' ? 'public' : 'private';
        if (payload.platformVisibility === 'public') {
          await this.advanceOnboarding(tgUserId, 'onboarding_future_vision', payload);
        } else {
          await this.advanceOnboarding(tgUserId, 'onboarding_quota_enabled', payload);
        }
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
        await this.advanceOnboarding(tgUserId, 'onboarding_quota_enabled', payload);
        return true;
      }
      case 'onboarding_quota_enabled':
        payload.quotaEnabled = normalized === 'да' || normalized === 'yes';
        if (payload.quotaEnabled) {
          await this.advanceOnboarding(tgUserId, 'onboarding_quota_amount', payload);
        } else {
          payload.dailyEmission = 0;
          await this.advanceOnboarding(tgUserId, 'onboarding_hashtag', payload);
        }
        return true;
      case 'onboarding_quota_amount': {
        const n = parseInt(text.trim(), 10);
        payload.dailyEmission = Number.isFinite(n) && n > 0 ? n : 5;
        await this.advanceOnboarding(tgUserId, 'onboarding_hashtag', payload);
        return true;
      }
      case 'onboarding_hashtag':
        payload.hashtag = text.trim().replace(/^#/, '').slice(0, 32) || 'заслуга';
        await this.advanceOnboarding(tgUserId, 'onboarding_post_cost', payload);
        return true;
      case 'onboarding_post_cost': {
        const cost = parseFloat(text.trim().replace(',', '.'));
        payload.postCost = Number.isFinite(cost) && cost >= 0 ? cost : 0;
        if (payload.platformIntegration === true) {
          await this.advanceOnboarding(tgUserId, 'onboarding_moderation', payload);
        } else {
          payload.moderation = false;
          payload.telegramPublicationAckEnabled = false;
          await this.advanceOnboarding(tgUserId, 'onboarding_welcome_merits', payload);
        }
        return true;
      }
      case 'onboarding_moderation':
        payload.moderation = normalized === 'да' || normalized === 'yes';
        await this.advanceOnboarding(tgUserId, 'onboarding_publication_ack', payload);
        return true;
      case 'onboarding_publication_ack':
        payload.telegramPublicationAckEnabled = normalized === 'да' || normalized === 'yes';
        await this.advanceOnboarding(tgUserId, 'onboarding_welcome_merits', payload);
        return true;
      case 'onboarding_welcome_merits': {
        const w = parseFloat(text.trim().replace(',', '.'));
        payload.welcomeMerits = Number.isFinite(w) && w >= 0 ? w : 0;
        await this.advanceOnboarding(tgUserId, 'onboarding_vote_panel', payload);
        return true;
      }
      case 'onboarding_vote_panel':
        payload.votePanelEnabled = normalized === 'да' || normalized === 'yes';
        await this.advanceOnboarding(tgUserId, 'onboarding_new_member_welcome', payload);
        return true;
      case 'onboarding_new_member_welcome':
        payload.newMemberWelcomeEnabled = normalized === 'да' || normalized === 'yes';
        await this.advanceOnboarding(tgUserId, 'onboarding_command_delivery', payload);
        return true;
      case 'onboarding_command_delivery': {
        const preset = parseOnboardingCommandDeliveryInput(text);
        if (!preset) {
          await this.tgBots.tgSend({
            tgChatId: tgUserId,
            text: 'Ответьте 1, 2 или 3 — см. варианты в вопросе выше.',
          });
          return true;
        }
        payload.telegramCommandRouting = commandRoutingFromOnboardingPreset(preset);
        await this.finishOnboarding(tgUserId, payload);
        return true;
      }
      case 'settings_edit_name': {
        const name = text.trim().slice(0, 120);
        if (!name) {
          await this.tgBots.tgSend({ tgChatId: tgUserId, text: TG_MSG.settingsEditEmptyName });
          return true;
        }
        await this.applySettingsUpdate(tgUserId, String(payload.communityId), { name });
        return true;
      }
      case 'settings_edit_quota': {
        const n = Number.parseInt(text.trim(), 10);
        if (!Number.isFinite(n) || n < 0) {
          await this.tgBots.tgSend({ tgChatId: tgUserId, text: TG_MSG.settingsEditInvalidNumber });
          return true;
        }
        const quotaEnabled = n > 0;
        await this.applySettingsUpdate(tgUserId, String(payload.communityId), {
          settings: { dailyEmission: quotaEnabled ? n : 0 },
          meritSettings: {
            quotaEnabled,
            dailyQuota: quotaEnabled ? n : 0,
          },
        });
        return true;
      }
      case 'settings_edit_post_cost': {
        const cost = Number.parseFloat(text.trim().replace(',', '.'));
        if (!Number.isFinite(cost) || cost < 0) {
          await this.tgBots.tgSend({ tgChatId: tgUserId, text: TG_MSG.settingsEditInvalidNumber });
          return true;
        }
        await this.applySettingsUpdate(tgUserId, String(payload.communityId), {
          settings: { postCost: cost },
        });
        return true;
      }
      case 'settings_edit_hashtag': {
        const hashtag = text.trim().replace(/^#/, '').slice(0, 32) || 'заслуга';
        await this.applySettingsUpdate(tgUserId, String(payload.communityId), {
          hashtags: [hashtag],
        });
        return true;
      }
      case 'settings_edit_welcome_merits': {
        const w = Number.parseFloat(text.trim().replace(',', '.'));
        if (!Number.isFinite(w) || w < 0) {
          await this.tgBots.tgSend({ tgChatId: tgUserId, text: TG_MSG.settingsEditInvalidNumber });
          return true;
        }
        await this.applySettingsUpdate(tgUserId, String(payload.communityId), {
          meritSettings: { startingMerits: w },
        });
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
  ): Promise<void> {
    const prompt = getOnboardingPrompt(nextAction, payload);
    await this.pendingModel.deleteMany({ telegramUserId: tgUserId }).exec();
    await this.savePending(tgUserId, nextAction, payload as Record<string, unknown>);
    const yesNoSteps: TelegramBotPendingActionType[] = [
      'onboarding_platform_integration',
      'onboarding_quota_enabled',
      'onboarding_moderation',
      'onboarding_publication_ack',
      'onboarding_vote_panel',
      'onboarding_new_member_welcome',
    ];
    if (yesNoSteps.includes(nextAction)) {
      await this.sendCallbackPrompt(tgUserId, prompt, 'onboard:yes', 'onboard:no');
    } else if (nextAction === 'onboarding_command_delivery') {
      await this.sendCommandDeliveryPrompt(tgUserId, prompt);
    } else {
      await this.tgBots.tgSend({ tgChatId: tgUserId, text: prompt });
    }
  }

  private async finishOnboarding(tgUserId: string, payload: OnboardingPayload): Promise<void> {
    const platformIntegration =
      TELEGRAM_ONBOARDING_PLATFORM_INTEGRATION_STEP_ENABLED &&
      payload.platformIntegration === true;
    const platformVisibility = payload.platformVisibility ?? 'private';
    const futureVisionText = payload.futureVisionText?.trim() ?? '';

    if (platformIntegration && platformVisibility === 'public' && !futureVisionText) {
      await this.tgBots.tgSend({ tgChatId: tgUserId, text: TG_MSG.onboardingFutureVisionEmpty });
      await this.savePending(tgUserId, 'onboarding_future_vision', payload as Record<string, unknown>);
      return;
    }

    await this.clearPending(tgUserId);
    const initiator = await this.ensureTelegramUser(tgUserId, {});
    if (!initiator) {
      return;
    }

    const createSettings: NonNullable<Parameters<CommunityService['createCommunity']>[0]['settings']> = {
      currencyNames: { singular: 'заслуга', plural: 'заслуги', genitive: 'заслуг' },
      dailyEmission: payload.quotaEnabled ? (payload.dailyEmission ?? 5) : 0,
      postCost: payload.postCost ?? 0,
      allowWithdraw: false,
      documentsMode: platformIntegration ? 'visionOrDescriptionOnly' : 'off',
      telegramPlatformIntegration: platformIntegration,
      ...(platformIntegration
        ? { telegramPlatformVisibility: platformVisibility }
        : {}),
    };

    const community = await this.communityService.createCommunity({
      name: payload.name ?? payload.chatTitle ?? 'Telegram-сообщество',
      description: platformIntegration
        ? 'Сообщество Meriter Telegram MVP'
        : 'Telegram-сообщество Meriter',
      typeTag: 'team',
      ...(platformIntegration && platformVisibility === 'public' && futureVisionText
        ? { futureVisionText }
        : {}),
      creatorUserId: initiator.id,
      settings: createSettings,
    });

    await this.communityService.updateCommunity(community.id, {
      hashtags: [payload.hashtag ?? 'заслуга'],
      meritSettings: {
        quotaEnabled: payload.quotaEnabled ?? false,
        dailyQuota: payload.dailyEmission ?? 0,
        startingMerits: payload.welcomeMerits ?? 0,
      },
    });

    await this.communityModel.updateOne(
      { id: community.id },
      {
        $set: {
          telegramChatId: payload.telegramChatId,
          'settings.telegramModerationEnabled': platformIntegration
            ? (payload.moderation ?? false)
            : false,
          'settings.telegramPublicationAckEnabled': platformIntegration
            ? (payload.telegramPublicationAckEnabled ?? false)
            : false,
          'settings.telegramVotePanelEnabled': payload.votePanelEnabled === true,
          'settings.telegramNewMemberWelcomeEnabled': payload.newMemberWelcomeEnabled !== false,
          'settings.telegramCommandRouting': payload.telegramCommandRouting ?? {},
          'settings.allowWithdraw': false,
          updatedAt: new Date(),
        },
      },
    );

    await this.communityService.addMember(community.id, initiator.id);
    await this.userCommunityRoleService.setRole(initiator.id, community.id, 'lead', true);
    await this.userService.addCommunityMembership(initiator.id, community.id);

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

    const usageInput = this.buildCommunityUsageInput(community, platformIntegration, {
      dailyEmission: payload.quotaEnabled ? (payload.dailyEmission ?? 0) : 0,
      welcomeMerits: payload.welcomeMerits ?? 0,
      votePanelEnabled: payload.votePanelEnabled === true,
      hashtags: [payload.hashtag ?? 'заслуга'],
    });
    await this.tgBots.tgSend({
      tgChatId: tgUserId,
      text: buildOnboardingDoneMessage(usageInput),
    });
    await this.sendGroupWelcome(payload.telegramChatId, usageInput, community.id);
  }

  private async sendGroupWelcome(
    chatId: string,
    usageInput: CommunityUsageRulesInput,
    communityId: string,
  ): Promise<void> {
    await this.tgBots.tgSend({
      tgChatId: chatId,
      text: buildGroupWelcomeMessage(usageInput),
    });
    await this.sendGroupMiniAppLinkPrompt(chatId, usageInput.botUsername, communityId);
  }

  private async sendNewMemberWelcomeIfEnabled(
    community: Community,
    chatId: string,
    profile: { first_name?: string; last_name?: string },
  ): Promise<void> {
    if (community.settings?.telegramNewMemberWelcomeEnabled === false) {
      return;
    }
    const greetingName = resolveNewMemberGreetingName(profile);
    await this.tgBots.tgSend({
      tgChatId: chatId,
      text: buildNewMemberWelcomeMessage(greetingName),
    });
  }

  private async sendMiniAppLink(
    community: Community,
    chatId: string,
    options: { pin: boolean; replyToMessageId?: number },
  ): Promise<void> {
    const botUsername = this.configService.get('bot')?.username?.replace(/^@/, '').trim();
    if (!botUsername) {
      if (options.replyToMessageId != null) {
        await this.sendBotEphemeral(chatId, TG_MSG.miniAppLinkUnavailable, options.replyToMessageId);
      } else {
        await this.tgBots.tgSend({ tgChatId: chatId, text: TG_MSG.miniAppLinkUnavailable });
      }
      return;
    }

    if (options.pin && community.telegramPinnedMiniAppMessageId != null) {
      await this.tgBots.tgUnpinChatMessage(chatId, community.telegramPinnedMiniAppMessageId);
    }

    if (options.replyToMessageId != null) {
      await this.tgBots.tgReplyMessage({
        chat_id: chatId,
        reply_to_message_id: options.replyToMessageId,
        text: TG_MSG.groupMiniAppLinkHint,
      });
    } else {
      await this.tgBots.tgSend({ tgChatId: chatId, text: TG_MSG.groupMiniAppLinkHint });
    }

    const linkMessageId = await this.tgBots.tgSendMessage({
      chat_id: chatId,
      text: buildTelegramMiniAppStartLink(botUsername, community.id),
    });
    if (linkMessageId == null) {
      return;
    }

    if (options.pin) {
      const pinned = await this.tgBots.tgPinChatMessage(chatId, linkMessageId);
      if (pinned) {
        await this.communityModel.updateOne(
          { id: community.id },
          {
            $set: {
              telegramPinnedMiniAppMessageId: linkMessageId,
              updatedAt: new Date(),
            },
          },
        );
      }
    }
  }

  private async sendGroupMiniAppLinkPrompt(
    chatId: string,
    botUsername?: string,
    communityId?: string,
  ): Promise<void> {
    const clean = botUsername?.replace(/^@/, '').trim();
    if (!clean || !communityId?.trim()) {
      return;
    }
    const community = await this.communityService.getCommunity(communityId);
    if (!community) {
      return;
    }
    await this.sendMiniAppLink(community, chatId, { pin: true });
  }

  private buildCommunityUsageInput(
    community: Community,
    platformIntegration?: boolean,
    overrides?: Pick<
      CommunityUsageRulesInput,
      'dailyEmission' | 'welcomeMerits' | 'votePanelEnabled' | 'hashtags'
    >,
  ): CommunityUsageRulesInput {
    const integrated =
      platformIntegration ?? community.settings?.telegramPlatformIntegration === true;
    const botUsername = this.configService.get('bot')?.username?.replace(/^@/, '');
    const quotaEnabled = community.meritSettings?.quotaEnabled === true;
    const dailyFromSettings =
      community.settings?.dailyEmission ?? community.meritSettings?.dailyQuota ?? 0;
    const dailyEmission =
      overrides?.dailyEmission ??
      (quotaEnabled && dailyFromSettings > 0 ? dailyFromSettings : 0);
    const welcomeMerits =
      overrides?.welcomeMerits ?? this.communityService.startingMeritsOnJoin(community);
    return {
      communityName: community.name,
      hashtags: overrides?.hashtags ?? community.hashtags,
      platformIntegration: integrated,
      botUsername,
      dailyEmission: dailyEmission > 0 ? dailyEmission : 0,
      welcomeMerits,
      votePanelEnabled:
        overrides?.votePanelEnabled ??
        community.settings?.telegramVotePanelEnabled === true,
    };
  }

  private async advanceOnboardingVisibility(
    tgUserId: string,
    payload: OnboardingPayload,
  ): Promise<void> {
    await this.pendingModel.deleteMany({ telegramUserId: tgUserId }).exec();
    await this.savePending(
      tgUserId,
      'onboarding_platform_visibility',
      payload as Record<string, unknown>,
    );
    await this.sendVisibilityPrompt(
      tgUserId,
      getOnboardingPrompt('onboarding_platform_visibility', payload),
    );
  }

  private async provisionLinkedTelegramCommunities(
    tgUserId: string,
    profile: { first_name?: string; last_name?: string; username?: string },
  ): Promise<void> {
    const ensured = await this.ensureTelegramUser(tgUserId, profile);
    const user = await this.userService.getUserById(ensured.id);
    const membershipIds = user?.communityMemberships ?? [];
    if (membershipIds.length === 0) {
      return;
    }
    const communities = await this.communityModel
      .find({
        id: { $in: membershipIds },
        telegramChatId: { $exists: true, $nin: [null, ''] },
        $or: [{ telegramFrozenAt: { $exists: false } }, { telegramFrozenAt: null }],
      })
      .lean();
    for (const doc of communities) {
      await this.provisionMember(doc as Community, tgUserId, profile);
    }
  }

  private async provisionMember(
    community: Community,
    tgUserId: string,
    profile: { first_name?: string; last_name?: string; username?: string },
  ) {
    const freshCommunity =
      (await this.communityService.getCommunity(community.id)) ?? community;
    const user = await this.ensureTelegramUser(tgUserId, profile);
    const role = await this.rolePersistence.findAnyRole(user.id, freshCommunity.id);
    if (!role) {
      await this.communityService.addMember(freshCommunity.id, user.id);
      await this.userCommunityRoleService.setRole(user.id, freshCommunity.id, 'participant', true);
    } else if (role.membershipStatus === 'frozen') {
      await this.rolePersistence.setMembershipStatus(user.id, freshCommunity.id, 'active', new Date());
    }
    await this.userService.addCommunityMembership(user.id, freshCommunity.id);
    const currency = freshCommunity.settings?.currencyNames ?? {
      singular: 'заслуга',
      plural: 'заслуги',
      genitive: 'заслуг',
    };
    await this.walletService.createOrGetWallet(user.id, freshCommunity.id, currency, {
      startingMeritsIfNewWallet: this.communityService.startingMeritsOnJoin(freshCommunity),
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

  private async helpMessage(
    communityId?: string,
    options?: { forStart?: boolean; isReturning?: boolean; tgUserId?: string },
  ): Promise<string> {
    const botUsername = this.configService.get('bot')?.username?.replace(/^@/, '');
    let community = communityId ? await this.communityService.getCommunity(communityId) : null;
    if (!community && options?.tgUserId) {
      community = await this.resolvePrimaryTelegramCommunityForUser(options.tgUserId);
    }

    let startWelcomeMerits: number | undefined;
    if (options?.forStart && !options?.isReturning && community) {
      const welcome = this.communityService.startingMeritsOnJoin(community);
      if (welcome > 0) {
        startWelcomeMerits = welcome;
      }
    }

    if (!community) {
      return buildTelegramHelpMessage('', { botUsername, startWelcomeMerits });
    }

    return buildTelegramHelpMessage('', {
      communityId: community.id,
      communityName: community.name,
      hashtags: community.hashtags,
      botUsername,
      platformIntegration: community.settings?.telegramPlatformIntegration === true,
      votePanelEnabled: community.settings?.telegramVotePanelEnabled === true,
      startWelcomeMerits,
    });
  }

  private async resolvePrimaryTelegramCommunityForUser(
    tgUserId: string,
  ): Promise<Community | null> {
    const user = await this.userService.getUserByAuthId('telegram', tgUserId);
    if (!user?.communityMemberships?.length) {
      return null;
    }
    const doc = await this.communityModel
      .findOne({
        id: { $in: user.communityMemberships },
        telegramChatId: { $exists: true, $nin: [null, ''] },
        $or: [{ telegramFrozenAt: { $exists: false } }, { telegramFrozenAt: null }],
      })
      .lean();
    return doc ? (doc as Community) : null;
  }

  private async isReturningMeriterMember(
    tgUserId: string,
    communityId: string,
  ): Promise<boolean> {
    const user = await this.userService.getUserByAuthId('telegram', tgUserId);
    if (!user) {
      return false;
    }
    const role = await this.userCommunityRoleService.getRole(user.id, communityId);
    return Boolean(role);
  }

  private async sendGuideToUser(
    tgUserId: string,
    community?: { hashtags?: string[]; settings?: { telegramVotePanelEnabled?: boolean } },
  ): Promise<boolean> {
    return this.tgBots.tgSend({
      tgChatId: tgUserId,
      text: buildTelegramGuideMessage({
        hashtags: community?.hashtags,
        votePanelEnabled: community?.settings?.telegramVotePanelEnabled === true,
      }),
      parseMode: 'HTML',
    });
  }

  /** Ephemeral bot reply (auto-deleted after TG_BOT_EPHEMERAL_TTL_SEC). */
  private async sendBotEphemeral(
    chatId: string,
    text: string,
    replyToMessageId?: number,
    reply_markup?: TelegramInlineReplyMarkup,
  ): Promise<number | null> {
    return this.tgBots.tgReplyEphemeral({
      chat_id: chatId,
      text,
      reply_to_message_id: replyToMessageId,
      reply_markup,
    });
  }

  private async sendBotOpenHint(
    chatId: string,
    botUsername: string,
    purpose: 'guide' | 'vote' | 'settings',
    replyToMessageId?: number,
  ): Promise<number | null> {
    const text =
      purpose === 'guide'
        ? TG_MSG.guideDmFailed(botUsername)
        : purpose === 'settings'
          ? TG_MSG.settingsDmFailed(botUsername)
          : TG_MSG.voteAmountDmFailed(botUsername);
    const startPayload = purpose === 'guide' ? 'guide' : purpose === 'settings' ? 'settings' : 'vote';
    const buttonLabel =
      purpose === 'guide'
        ? TG_BOT_OPEN_BUTTON_LABELS.guide
        : purpose === 'settings'
          ? TG_BOT_OPEN_BUTTON_LABELS.settings
          : TG_BOT_OPEN_BUTTON_LABELS.vote;
    return this.sendBotEphemeral(
      chatId,
      text,
      replyToMessageId,
      buildTelegramBotOpenKeyboard(botUsername, startPayload, buttonLabel),
    );
  }

  /** Auto-delete user's bot command after the same TTL as bot replies. */
  private scheduleEphemeralUserMessage(chatId: string, messageId?: number): void {
    if (messageId == null) {
      return;
    }
    this.tgBots.tgScheduleDeleteMessage(chatId, messageId);
  }

  private async answerCallback(callbackQueryId: string, text?: string): Promise<void> {
    const token = this.configService.get('bot')?.token;
    if (!token || this.configService.get('noAxios')) {
      return;
    }
    try {
      const Axios = (await import('axios')).default;
      const apiUrl = this.configService.get('telegram')?.apiUrl ?? 'https://api.telegram.org';
      await Axios.post(`${apiUrl}/bot${token}/answerCallbackQuery`, {
        callback_query_id: callbackQueryId,
        ...(text ? { text } : {}),
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
        const voterLabel = await this.resolveVoterLabel(voterId);
        const recipient = await this.resolveVoteRecipientLabels(publicationId);
        await this.sendVoteSuccessReport(groupFeedback, voterLabel, amount, direction, recipient);
      }
      this.scheduleRefreshVotePanel(publicationId);
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

  private async resolveVoterLabel(voterId: string): Promise<string> {
    const user = await this.userService.getUserById(voterId);
    if (!user) {
      return 'Участник';
    }
    return formatTelegramMemberLabel(
      {
        displayName: user.displayName,
        username: user.username,
      },
      voterId,
    );
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
    return { quotaAmount: amount, walletAmount: 0 };
  }

  private async getPublicationVoteBlockReason(
    voterId: string,
    publicationId: string,
  ): Promise<'author' | 'beneficiary' | null> {
    const publication = await this.publicationService.getPublication(publicationId);
    if (!publication) {
      return null;
    }
    const authorId = publication.getAuthorId.getValue();
    const beneficiaryId = publication.getBeneficiaryId?.getValue();
    return resolvePublicationVoteBlockReason(authorId, beneficiaryId, voterId);
  }

  private memberLabelFromUser(
    user: {
      displayName?: string;
      username?: string;
      firstName?: string;
      lastName?: string;
    } | null | undefined,
    userId: string,
    fallback: string,
  ): string {
    if (!user) {
      return fallback;
    }
    return formatTelegramMemberLabel(
      {
        displayName: user.displayName,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      userId,
    );
  }

  private async resolveVoteRecipientLabels(
    publicationId: string,
  ): Promise<{ credit: string; debit: string; nominator?: string }> {
    const publication = await this.publicationService.getPublication(publicationId);
    if (!publication) {
      return { credit: 'автору', debit: 'автора' };
    }
    const authorId = publication.getAuthorId.getValue();
    const beneficiaryId = publication.getBeneficiaryId?.getValue() ?? authorId;
    if (beneficiaryId === authorId) {
      return { credit: 'автору', debit: 'автора' };
    }
    const beneficiaryUser = await this.userService.getUserById(beneficiaryId);
    const beneficiaryLabel = this.memberLabelFromUser(
      beneficiaryUser,
      beneficiaryId,
      'получателю',
    );
    const authorUser = await this.userService.getUserById(authorId);
    const nominatorLabel = this.memberLabelFromUser(authorUser, authorId, 'автора');
    return {
      credit: beneficiaryLabel,
      debit: beneficiaryLabel,
      nominator: nominatorLabel,
    };
  }

  private async promptVoteAmount(
    community: Community,
    voterId: string,
    tgUserId: string,
    publicationId: string,
    direction: 'up' | 'down',
    context?: {
      groupChatId?: string;
      replyToMessageId?: number;
      reactedMessageId?: number;
      voterFirstName?: string;
      voterLastName?: string;
      voterUsername?: string;
      numericPrompt?: boolean;
    },
  ): Promise<void> {
    const pendingId = uid();
    const balance = await this.getVoteAmountBalance(community, voterId);

    if (!context?.groupChatId || context.replyToMessageId == null) {
      await this.pendingModel.create({
        id: pendingId,
        telegramUserId: tgUserId,
        action: 'confirm_vote_amount',
        payload: { voterId, publicationId, direction },
        expiresAt: new Date(Date.now() + PENDING_TTL_MS),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const basePrompt =
        direction === 'down' ? TG_MSG.voteAmountDmPromptDown : TG_MSG.voteAmountDmPrompt;
      const hint = formatVoteAmountBalanceHint(balance.wallet, balance.quota, direction);
      const dmSent = await this.tgBots.tgSend({
        tgChatId: tgUserId,
        text: `${basePrompt}${hint}`,
      });
      if (!dmSent) {
        await this.pendingModel.deleteOne({ id: pendingId }).exec();
        const botUsername =
          this.configService.get('bot')?.username?.replace(/^@/, '') ?? 'meriterbot';
        await this.tgBots.tgSend({
          tgChatId: tgUserId,
          text: TG_MSG.voteAmountDmFailed(botUsername),
        });
      }
      return;
    }

    const displayName = buildTelegramVoterDisplayName({
      firstName: context.voterFirstName,
      lastName: context.voterLastName,
      username: context.voterUsername,
    });

    await this.pendingModel.create({
      id: pendingId,
      telegramUserId: tgUserId,
      action: 'confirm_vote_amount',
      payload: {
        voterId,
        publicationId,
        direction,
        groupChatId: context.groupChatId,
        reactedMessageId: context.reactedMessageId ?? context.replyToMessageId,
        promptMessageId: context.replyToMessageId,
      },
      expiresAt: new Date(Date.now() + PENDING_TTL_MS),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const promptMessageId = context.numericPrompt
      ? await this.sendVoteAmountGroupNumericPrompt(
          context.groupChatId,
          context.replyToMessageId,
          pendingId,
          Number.parseInt(tgUserId, 10),
          displayName,
          direction,
          balance,
        )
      : await this.sendVoteAmountGroupPromptWithKeyboard(
          context.groupChatId,
          context.replyToMessageId,
          pendingId,
          Number.parseInt(tgUserId, 10),
          displayName,
          direction,
          balance,
        );
    if (promptMessageId != null) {
      await this.pendingModel
        .updateOne(
          { id: pendingId },
          {
            $set: {
              'payload.promptMessageId': promptMessageId,
              updatedAt: new Date(),
            },
          },
        )
        .exec();
      return;
    }

    await this.pendingModel.deleteOne({ id: pendingId }).exec();
    const botUsername = this.configService.get('bot')?.username?.replace(/^@/, '') ?? 'meriterbot';
    await this.sendBotOpenHint(
      context.groupChatId,
      botUsername,
      'vote',
      context.replyToMessageId,
    );
  }

  private async sendVoteSuccessReport(
    groupFeedback: GroupFeedbackContext,
    voterLabel: string,
    amount: number,
    direction: 'up' | 'down',
    recipient?: { credit: string; debit: string; nominator?: string },
  ): Promise<void> {
    const text = TG_MSG.voteSuccess(voterLabel, amount, direction, recipient);
    const community = await this.communityModel
      .findOne({ telegramChatId: groupFeedback.groupChatId })
      .select({ settings: 1 })
      .lean();
    const ephemeral = community?.settings?.telegramVoteSuccessEphemeral !== false;
    if (groupFeedback.replyToMessageId != null) {
      if (ephemeral) {
        await this.tgBots.tgReplyEphemeral({
          chat_id: groupFeedback.groupChatId,
          reply_to_message_id: groupFeedback.replyToMessageId,
          text,
        });
      } else {
        await this.tgBots.tgReplyMessage({
          chat_id: groupFeedback.groupChatId,
          reply_to_message_id: groupFeedback.replyToMessageId,
          text,
        });
      }
      return;
    }
    if (ephemeral) {
      await this.tgBots.tgReplyEphemeral({
        chat_id: groupFeedback.groupChatId,
        text,
      });
    } else {
      await this.tgBots.tgSendMessage({ chat_id: groupFeedback.groupChatId, text });
    }
  }

  private async handleVoteAmountCallback(
    tgUserId: string,
    pendingId: string,
    amount: number,
    query: Record<string, unknown>,
  ): Promise<void> {
    const pending = await this.pendingModel.findOne({ id: pendingId }).lean();
    if (!pending) {
      return;
    }
    if (pending.telegramUserId !== tgUserId) {
      const message = query.message as
        | { chat?: { id: number }; message_id?: number }
        | undefined;
      if (message?.chat?.id != null && message.message_id != null) {
        await this.tgBots.tgReplyEphemeral({
          chat_id: String(message.chat.id),
          reply_to_message_id: message.message_id,
          text: TG_MSG.voteAmountWrongUser,
        });
      }
      return;
    }
    await this.confirmVoteAmount(tgUserId, pendingId, amount);
  }

  private async confirmVoteAmount(
    tgUserId: string,
    pendingId: string,
    amount: number,
    options?: {
      ephemeralUserReply?: { chatId: string; messageId: number };
      directionOverride?: 'up' | 'down';
      directionFlippedNotice?: 'up' | 'down';
    },
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
      reactedMessageId?: number;
    };
    await this.pendingModel.deleteOne({ id: pendingId }).exec();
    if (options?.ephemeralUserReply) {
      this.scheduleEphemeralUserMessage(
        options.ephemeralUserReply.chatId,
        options.ephemeralUserReply.messageId,
      );
    }
    const direction = options?.directionOverride ?? payload.direction;
    const groupFeedback =
      payload.groupChatId && payload.reactedMessageId != null
        ? {
            groupChatId: payload.groupChatId,
            replyToMessageId: payload.reactedMessageId,
          }
        : undefined;
    if (options?.directionFlippedNotice && groupFeedback) {
      const flipText =
        options.directionFlippedNotice === 'down'
          ? TG_MSG.voteDirectionFlippedFromSign
          : TG_MSG.voteDirectionFlippedFromSignUp;
      await this.tgBots.tgReplyEphemeral({
        chat_id: groupFeedback.groupChatId,
        reply_to_message_id: groupFeedback.replyToMessageId,
        text: flipText,
      });
    }
    await this.executeVote(
      payload.voterId,
      payload.publicationId,
      amount,
      direction,
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
        text: TG_MSG.reactionPostNotFound(primaryCommunityHashtag(community.hashtags)),
      });
      return;
    }
    const voteBlockReason = await this.getPublicationVoteBlockReason(voterId, anchor.publicationId);
    if (voteBlockReason) {
      await this.tgBots.tgReplyEphemeral({
        chat_id: chatId,
        reply_to_message_id: replyMessageId,
        text:
          voteBlockReason === 'beneficiary'
            ? TG_MSG.cannotVoteAsBeneficiary
            : TG_MSG.cannotVoteOwnPost,
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

  private async sendSettingsToUser(tgUserId: string, community: Community): Promise<boolean> {
    const summary = buildSettingsLeadSummary(community);
    return this.tgBots.tgSend({
      tgChatId: tgUserId,
      text: summary,
      reply_markup: buildSettingsEditKeyboard(community.id, {
        reactionNoHashtagHintEnabled:
          community.settings?.telegramReactionNoHashtagHintEnabled !== false,
        votePanelEnabled: community.settings?.telegramVotePanelEnabled === true,
        voteSuccessEphemeral: community.settings?.telegramVoteSuccessEphemeral !== false,
        newMemberWelcomeEnabled: community.settings?.telegramNewMemberWelcomeEnabled !== false,
        commandRouting: community.settings?.telegramCommandRouting,
      }),
    });
  }

  private async getVoteAmountBalance(
    community: Community,
    voterId: string,
  ): Promise<{ wallet: number; quota: number }> {
    const stats = await this.getMemberStats(community, voterId);
    return { wallet: stats.wallet, quota: stats.quota };
  }

  private async resolveCommunityForVotePending(payload: {
    groupChatId?: string;
    publicationId?: string;
  }): Promise<Community | null> {
    if (payload.groupChatId) {
      return this.findCommunityByChatId(payload.groupChatId);
    }
    if (payload.publicationId) {
      const publication = await this.publicationService.getPublication(payload.publicationId);
      if (!publication) {
        return null;
      }
      return this.communityService.getCommunity(publication.getCommunityId.getValue());
    }
    return null;
  }

  private async toggleReactionNoHashtagHint(
    tgUserId: string,
    communityId: string,
  ): Promise<string> {
    const user = await this.userService.getUserByAuthId('telegram', tgUserId);
    if (!user) {
      return TG_MSG.settingsLeadOnly;
    }
    const role = await this.userCommunityRoleService.getRole(user.id, communityId);
    if (role?.role !== 'lead') {
      return TG_MSG.settingsLeadOnly;
    }
    const community = await this.communityService.getCommunity(communityId);
    if (!community) {
      return TG_MSG.noLinkedCommunity;
    }
    const enabled = community.settings?.telegramReactionNoHashtagHintEnabled !== false;
    const next = !enabled;
    await this.communityModel.updateOne(
      { id: communityId },
      {
        $set: {
          'settings.telegramReactionNoHashtagHintEnabled': next,
          updatedAt: new Date(),
        },
      },
    );
    return TG_MSG.settingsReactionNoHashtagHintToggled(next);
  }

  private async toggleNewMemberWelcome(
    tgUserId: string,
    communityId: string,
  ): Promise<string> {
    const user = await this.userService.getUserByAuthId('telegram', tgUserId);
    if (!user) {
      return TG_MSG.settingsLeadOnly;
    }
    const role = await this.userCommunityRoleService.getRole(user.id, communityId);
    if (role?.role !== 'lead') {
      return TG_MSG.settingsLeadOnly;
    }
    const community = await this.communityService.getCommunity(communityId);
    if (!community) {
      return TG_MSG.noLinkedCommunity;
    }
    const enabled = community.settings?.telegramNewMemberWelcomeEnabled !== false;
    const next = !enabled;
    await this.communityModel.updateOne(
      { id: communityId },
      {
        $set: {
          'settings.telegramNewMemberWelcomeEnabled': next,
          updatedAt: new Date(),
        },
      },
    );
    return TG_MSG.settingsNewMemberWelcomeToggled(next);
  }

  private async toggleVoteSuccessEphemeral(
    tgUserId: string,
    communityId: string,
  ): Promise<string> {
    const user = await this.userService.getUserByAuthId('telegram', tgUserId);
    if (!user) {
      return TG_MSG.settingsLeadOnly;
    }
    const role = await this.userCommunityRoleService.getRole(user.id, communityId);
    if (role?.role !== 'lead') {
      return TG_MSG.settingsLeadOnly;
    }
    const community = await this.communityService.getCommunity(communityId);
    if (!community) {
      return TG_MSG.noLinkedCommunity;
    }
    const enabled = community.settings?.telegramVoteSuccessEphemeral !== false;
    const next = !enabled;
    await this.communityModel.updateOne(
      { id: communityId },
      {
        $set: {
          'settings.telegramVoteSuccessEphemeral': next,
          updatedAt: new Date(),
        },
      },
    );
    return TG_MSG.settingsVoteSuccessEphemeralToggled(next);
  }

  private async beginSettingsEdit(
    tgUserId: string,
    communityId: string,
    field: SettingsEditField,
  ): Promise<void> {
    const action = settingsEditFieldToAction(field);

    const user = await this.userService.getUserByAuthId('telegram', tgUserId);
    if (!user) {
      return;
    }
    const role = await this.userCommunityRoleService.getRole(user.id, communityId);
    if (role?.role !== 'lead') {
      await this.tgBots.tgSend({ tgChatId: tgUserId, text: TG_MSG.settingsLeadOnly });
      return;
    }

    await this.pendingModel.deleteMany({ telegramUserId: tgUserId }).exec();
    await this.savePending(tgUserId, action, { communityId });
    await this.tgBots.tgSend({ tgChatId: tgUserId, text: getSettingsEditPrompt(action) });
  }

  private async applySettingsUpdate(
    tgUserId: string,
    communityId: string,
    dto: Parameters<CommunityService['updateCommunity']>[1],
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
    try {
      const updated = await this.communityService.updateCommunity(communityId, dto);
      await this.clearPending(tgUserId);
      await this.tgBots.tgSend({
        tgChatId: tgUserId,
        text: TG_MSG.settingsUpdated(communitySettingsSnapshot(updated)),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.tgBots.tgSend({
        tgChatId: tgUserId,
        text: mapTelegramUserFacingError(message),
      });
    }
  }

  private async sendVoteAmountRetryPrompt(
    chatId: string,
    pendingId: string,
    replyToUserMessageId?: number,
  ): Promise<void> {
    const pending = await this.pendingModel.findOne({ id: pendingId }).lean();
    const payload = pending?.payload as
      | {
          voterId?: string;
          direction?: 'up' | 'down';
          groupChatId?: string;
          publicationId?: string;
        }
      | undefined;
    let retryText = TG_MSG.voteAmountInvalidRetry;
    if (payload?.voterId && payload.direction) {
      const community = await this.resolveCommunityForVotePending(payload);
      if (community) {
        const balance = await this.getVoteAmountBalance(community, payload.voterId);
        retryText += formatVoteAmountBalanceHint(
          balance.wallet,
          balance.quota,
          payload.direction,
        );
      }
    }
    const messageId = await this.sendTelegramForceReply(
      chatId,
      retryText,
      replyToUserMessageId,
    );
    if (messageId != null) {
      await this.pendingModel
        .updateOne(
          { id: pendingId },
          {
            $set: {
              'payload.promptMessageId': messageId,
              updatedAt: new Date(),
            },
          },
        )
        .exec();
    }
    if (replyToUserMessageId != null) {
      this.scheduleEphemeralUserMessage(chatId, replyToUserMessageId);
    }
  }

  private async sendTelegramForceReply(
    chatId: string,
    text: string,
    replyToMessageId?: number,
    entities?: Array<Record<string, unknown>>,
  ): Promise<number | null> {
    const token = this.configService.get('bot')?.token;
    if (!token || this.configService.get('noAxios')) {
      if (replyToMessageId != null) {
        return this.tgBots.tgReplyEphemeral({
          chat_id: chatId,
          reply_to_message_id: replyToMessageId,
          text,
        });
      }
      const messageId = await this.tgBots.tgSendMessage({ chat_id: chatId, text });
      return messageId;
    }
    try {
      const Axios = (await import('axios')).default;
      const apiUrl = this.configService.get('telegram')?.apiUrl ?? 'https://api.telegram.org';
      const res = await Axios.post(`${apiUrl}/bot${token}/sendMessage`, {
        chat_id: chatId,
        ...(replyToMessageId != null ? { reply_to_message_id: replyToMessageId } : {}),
        text,
        ...(entities?.length ? { entities } : {}),
        reply_markup: {
          force_reply: true,
          selective: replyToMessageId != null,
          input_field_placeholder: 'Сумма заслуг',
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
    if (replyToMessageId != null) {
      return this.tgBots.tgReplyEphemeral({
        chat_id: chatId,
        reply_to_message_id: replyToMessageId,
        text,
      });
    }
    return this.tgBots.tgSendMessage({ chat_id: chatId, text });
  }

  private async sendVoteAmountGroupPromptWithKeyboard(
    chatId: string,
    replyToMessageId: number,
    pendingId: string,
    tgUserId: number,
    displayName: string,
    direction: 'up' | 'down',
    balance: { wallet: number; quota: number },
  ): Promise<number | null> {
    const { text, entities } = buildVoteAmountGroupMentionMessage(
      tgUserId,
      displayName,
      direction,
      balance,
    );
    const token = this.configService.get('bot')?.token;
    if (!token || this.configService.get('noAxios')) {
      return this.tgBots.tgReplyEphemeral({
        chat_id: chatId,
        reply_to_message_id: replyToMessageId,
        text,
      });
    }
    const [l1, l2, l3] = voteAmountButtonLabels(direction);
    try {
      const Axios = (await import('axios')).default;
      const apiUrl = this.configService.get('telegram')?.apiUrl ?? 'https://api.telegram.org';
      const res = await Axios.post(`${apiUrl}/bot${token}/sendMessage`, {
        chat_id: chatId,
        reply_to_message_id: replyToMessageId,
        text,
        entities,
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
      text,
    });
  }

  private async sendVoteAmountGroupNumericPrompt(
    chatId: string,
    replyToMessageId: number,
    _pendingId: string,
    tgUserId: number,
    displayName: string,
    direction: 'up' | 'down',
    balance: { wallet: number; quota: number },
  ): Promise<number | null> {
    const { text, entities } = buildVoteAmountGroupNumericMentionMessage(
      tgUserId,
      displayName,
      direction,
      balance,
    );
    return this.sendTelegramForceReply(
      chatId,
      text,
      replyToMessageId,
      entities as Array<Record<string, unknown>>,
    );
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

  private async sendVisibilityPrompt(tgUserId: string, text: string): Promise<void> {
    const token = this.configService.get('bot')?.token;
    if (!token || this.configService.get('noAxios')) {
      await this.tgBots.tgSend({
        tgChatId: tgUserId,
        text: `${text}\n\nОтветьте «приватное» или «публичное».`,
      });
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
            { text: 'Приватное', callback_data: 'onboard:vis:private' },
            { text: 'Публичное', callback_data: 'onboard:vis:public' },
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

  private async sendCommandDeliveryPrompt(tgUserId: string, text: string): Promise<void> {
    const token = this.configService.get('bot')?.token;
    if (!token || this.configService.get('noAxios')) {
      await this.tgBots.tgSend({
        tgChatId: tgUserId,
        text: `${text}\n\nОтветьте 1, 2 или 3.`,
      });
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
            { text: '1 — группа, исчезает', callback_data: 'onboard:cmd_del:group_ephemeral' },
            { text: '2 — группа, остаётся', callback_data: 'onboard:cmd_del:group_permanent' },
          ], [
            { text: '3 — личка', callback_data: 'onboard:cmd_del:dm' },
          ]],
        },
      });
    } catch {
      await this.tgBots.tgSend({ tgChatId: tgUserId, text });
    }
  }

  private async deliverRoutedCommand(
    ctx: BotCommandContext,
    delivery: TelegramCommandDelivery,
    buildText: () => Promise<string> | string,
    options?: { onDm?: () => Promise<void> },
  ): Promise<void> {
    const { tgUserId, replyChatId, message, replyInGroup } = ctx;
    const replyTo = replyInGroup ? (message?.message_id as number | undefined) : undefined;

    if (delivery.destination === 'dm') {
      if (options?.onDm) {
        await options.onDm();
      } else {
        const text = await buildText();
        await this.tgBots.tgSend({ tgChatId: tgUserId, text });
      }
      if (replyInGroup && replyTo != null) {
        await this.sendBotEphemeral(replyChatId, TG_MSG.commandAnswerInDm, replyTo);
      }
      return;
    }

    if (options?.onDm) {
      return;
    }

    const text = await buildText();
    if (delivery.ephemeral) {
      await this.sendBotEphemeral(replyChatId, text, replyTo);
    } else if (replyTo != null) {
      await this.tgBots.tgReplyMessage({
        chat_id: replyChatId,
        reply_to_message_id: replyTo,
        text,
      });
    } else {
      await this.tgBots.tgSendMessage({ chat_id: replyChatId, text });
    }
  }

  private async sendMiniAppLinkToDm(community: Community, tgUserId: string): Promise<void> {
    const botUsername = this.configService.get('bot')?.username?.replace(/^@/, '').trim();
    if (!botUsername) {
      await this.tgBots.tgSend({ tgChatId: tgUserId, text: TG_MSG.miniAppLinkUnavailable });
      return;
    }
    await this.tgBots.tgSend({
      tgChatId: tgUserId,
      text: `${TG_MSG.groupMiniAppLinkHint}\n\n${buildTelegramMiniAppStartLink(botUsername, community.id)}`,
    });
  }

  private async toggleVotePanel(tgUserId: string, communityId: string): Promise<string> {
    const user = await this.userService.getUserByAuthId('telegram', tgUserId);
    if (!user) {
      return TG_MSG.settingsLeadOnly;
    }
    const role = await this.userCommunityRoleService.getRole(user.id, communityId);
    if (role?.role !== 'lead') {
      return TG_MSG.settingsLeadOnly;
    }
    const community = await this.communityService.getCommunity(communityId);
    if (!community) {
      return TG_MSG.noLinkedCommunity;
    }
    const enabled = community.settings?.telegramVotePanelEnabled === true;
    const next = !enabled;
    await this.communityModel.updateOne(
      { id: communityId },
      {
        $set: {
          'settings.telegramVotePanelEnabled': next,
          updatedAt: new Date(),
        },
      },
    );
    return TG_MSG.settingsVotePanelToggled(next);
  }

  private async cycleCommandRoute(
    tgUserId: string,
    communityId: string,
    cmd: TelegramRoutableCommand,
  ): Promise<string> {
    const user = await this.userService.getUserByAuthId('telegram', tgUserId);
    if (!user) {
      return TG_MSG.settingsLeadOnly;
    }
    const role = await this.userCommunityRoleService.getRole(user.id, communityId);
    if (role?.role !== 'lead') {
      return TG_MSG.settingsLeadOnly;
    }
    const community = await this.communityService.getCommunity(communityId);
    if (!community) {
      return TG_MSG.noLinkedCommunity;
    }
    const routing = { ...(community.settings?.telegramCommandRouting ?? {}) };
    const current = resolveTelegramCommandDelivery(routing, cmd);
    const next = cycleTelegramCommandDelivery(current);
    routing[cmd] = next;
    await this.communityModel.updateOne(
      { id: communityId },
      {
        $set: {
          'settings.telegramCommandRouting': routing,
          updatedAt: new Date(),
        },
      },
    );
    return TG_MSG.settingsCommandRouteCycled(formatTelegramCommandDeliveryLabel(cmd, next));
  }

  private async createVotePanelForPublication(
    community: Community,
    publicationId: string,
    hashtagMessageId: number,
  ): Promise<void> {
    const chatId = community.telegramChatId;
    if (!chatId) {
      return;
    }

    const recipient = await this.resolveVotePanelRecipient(publicationId);
    const publication = await this.publicationService.getPublication(publicationId);
    if (!publication) {
      return;
    }

    const metrics = {
      upMerits: publication.getMetrics.upvotes,
      downMerits: publication.getMetrics.downvotes,
    };

    const panelMessageId = await this.tgBots.tgSendMessage({
      chat_id: chatId,
      text: buildVotePanelMessageText(recipient, metrics),
      reply_to_message_id: hashtagMessageId,
      reply_markup: buildVotePanelKeyboard(publicationId),
    });
    if (panelMessageId == null) {
      return;
    }

    const now = new Date();
    await this.anchorModel.updateOne(
      { telegramChatId: chatId, telegramMessageId: panelMessageId },
      {
        $set: {
          communityId: community.id,
          publicationId,
          anchorType: 'vote_panel',
          updatedAt: now,
        },
        $setOnInsert: {
          id: uid(),
          telegramChatId: chatId,
          telegramMessageId: panelMessageId,
          createdAt: now,
        },
      },
      { upsert: true },
    );
  }

  private async resolveVotePanelRecipient(publicationId: string) {
    const publication = await this.publicationService.getPublication(publicationId);
    if (!publication) {
      return { displayName: 'автор', isNomination: false };
    }
    const authorId = publication.getAuthorId.getValue();
    const beneficiaryId = publication.getBeneficiaryId?.getValue() ?? authorId;
    const beneficiaryUser = await this.userService.getUserById(beneficiaryId);
    const beneficiaryDisplay = this.memberLabelFromUser(
      beneficiaryUser,
      beneficiaryId,
      'получателю',
    );
    if (beneficiaryId === authorId) {
      return { displayName: beneficiaryDisplay, isNomination: false };
    }
    const authorUser = await this.userService.getUserById(authorId);
    const nominatorDisplay = this.memberLabelFromUser(authorUser, authorId, 'автор');
    return {
      displayName: beneficiaryDisplay,
      isNomination: true,
      nominatorDisplayName: nominatorDisplay,
    };
  }

  private async handleVotePanelCallback(
    tgUserId: string,
    parsed: ReturnType<typeof parseVotePanelCallback>,
    query: Record<string, unknown>,
  ): Promise<void> {
    if (!parsed) {
      return;
    }

    const from = query.from as {
      id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
    const message = query.message as { chat?: { id: number }; message_id?: number } | undefined;
    const panelChatId = message?.chat?.id != null ? String(message.chat.id) : undefined;
    const panelMessageId = message?.message_id;

    const publication = await this.publicationService.getPublication(parsed.publicationId);
    if (!publication) {
      return;
    }

    const community = await this.communityService.getCommunity(
      publication.getCommunityId.getValue(),
    );
    if (!community?.telegramChatId || community.telegramFrozenAt) {
      return;
    }

    const voter = await this.provisionMember(community, tgUserId, from);
    if (!voter || (await this.isMemberFrozen(voter.id, community.id))) {
      await this.tgBots.tgSend({ tgChatId: tgUserId, text: TG_MSG.frozenMember });
      return;
    }

    const voteBlockReason = await this.getPublicationVoteBlockReason(
      voter.id,
      parsed.publicationId,
    );
    if (voteBlockReason) {
      await this.tgBots.tgSend({
        tgChatId: tgUserId,
        text:
          voteBlockReason === 'beneficiary'
            ? TG_MSG.cannotVoteAsBeneficiary
            : TG_MSG.cannotVoteOwnPost,
      });
      return;
    }

    const hashtagAnchor = await this.anchorModel
      .findOne({ publicationId: parsed.publicationId, anchorType: 'hashtag' })
      .lean();
    const hashtagMessageId = hashtagAnchor?.telegramMessageId;

    const wantsCustom =
      ('custom' in parsed && parsed.custom === true) || parsed.direction === 'down';
    if (wantsCustom) {
      await this.promptVoteAmount(
        community,
        voter.id,
        tgUserId,
        parsed.publicationId,
        parsed.direction,
        {
        groupChatId: panelChatId ?? community.telegramChatId,
        replyToMessageId: panelMessageId ?? hashtagMessageId,
        reactedMessageId: hashtagMessageId,
        voterFirstName: from.first_name,
        voterLastName: from.last_name,
        voterUsername: from.username,
        numericPrompt: true,
      });
      return;
    }

    const groupFeedback =
      hashtagMessageId != null
        ? {
            groupChatId: community.telegramChatId,
            replyToMessageId: hashtagMessageId,
          }
        : undefined;

    await this.executeVote(
      voter.id,
      parsed.publicationId,
      parsed.amount,
      parsed.direction,
      undefined,
      tgUserId,
      groupFeedback,
    );
  }

  private scheduleRefreshVotePanel(publicationId: string): void {
    const existing = this.votePanelRefreshTimers.get(publicationId);
    if (existing) {
      clearTimeout(existing);
    }
    const timer = setTimeout(() => {
      this.votePanelRefreshTimers.delete(publicationId);
      void this.refreshVotePanel(publicationId);
    }, 1000);
    timer.unref();
    this.votePanelRefreshTimers.set(publicationId, timer);
  }

  private async refreshVotePanel(publicationId: string): Promise<void> {
    if (this.connection.readyState !== 1) {
      return;
    }

    try {
      const panelAnchor = await this.anchorModel
        .findOne({ publicationId, anchorType: 'vote_panel' })
        .lean();
      if (!panelAnchor) {
        return;
      }

      const publication = await this.publicationService.getPublication(publicationId);
      if (!publication) {
        return;
      }

      const metrics = {
        upMerits: publication.getMetrics.upvotes,
        downMerits: publication.getMetrics.downvotes,
      };

      const recipient = await this.resolveVotePanelRecipient(publicationId);

      await this.tgBots.tgEditMessageText({
        chat_id: panelAnchor.telegramChatId,
        message_id: panelAnchor.telegramMessageId,
        text: buildVotePanelMessageText(recipient, metrics),
        reply_markup: buildVotePanelKeyboard(publicationId),
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === 'MongoNotConnectedError' || error.message.includes('must be connected'))
      ) {
        return;
      }
      throw error;
    }
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
