import { Injectable, Logger } from '@nestjs/common';
import { PublicationService } from '../domain/services/publication.service';
import { CommunityRepository } from '../domain/models/community/community.repository';
import { UserRepository } from '../domain/models/user/user.repository';
import { TelegramMessageProcessorService, ParsedMessage } from './message-processor.service';
import { TelegramMessage } from './message-processor.service';

@Injectable()
export class TelegramPublicationCreatorService {
  private readonly logger = new Logger(TelegramPublicationCreatorService.name);

  constructor(
    private publicationService: PublicationService,
    private communityRepository: CommunityRepository,
    private userRepository: UserRepository,
    private messageProcessor: TelegramMessageProcessorService,
  ) {}

  async createPublicationFromMessage(message: TelegramMessage): Promise<void> {
    this.logger.log(`Creating publication from message: ${message.messageId}`);

    // Parse the message
    const parsedMessage = this.messageProcessor.parseMessage(message);

    // Find community
    const community = await this.communityRepository.findByTelegramChatId(message.chatId);
    if (!community) {
      this.logger.warn(`Community not found for chat: ${message.chatId}`);
      return;
    }

    // Validate message has valid hashtags
    if (!this.messageProcessor.isValidPublicationMessage(parsedMessage, community.hashtags)) {
      this.logger.log(`Message ${message.messageId} has no valid hashtags, skipping`);
      return;
    }

    // Find or create user
    let user = await this.userRepository.findByTelegramId(message.userId);
    if (!user) {
      this.logger.log(`Creating new user: ${message.userId}`);
      user = await this.userRepository.createUser(
        message.userId,
        `User ${message.userId}`, // Default display name
        undefined,
        undefined,
        undefined
      );
    }

    // Find beneficiary if specified
    let beneficiaryId: string | undefined;
    if (parsedMessage.beneficiary) {
      const beneficiary = await this.userRepository.findByUsername(parsedMessage.beneficiary.username || '');
      if (beneficiary) {
        beneficiaryId = beneficiary.id;
      } else {
        this.logger.warn(`Beneficiary not found: ${parsedMessage.beneficiary.username}`);
      }
    }

    // Determine message type
    const messageType = this.messageProcessor.determineMessageType(message);

    // Create publication
    try {
      const publication = await this.publicationService.createPublication(user.id, {
        communityId: community.id,
        content: parsedMessage.cleanedText,
        type: messageType,
        beneficiaryId,
        hashtags: parsedMessage.hashtags,
        imageUrl: message.photo?.[0], // Use first photo if available
        videoUrl: message.video,
      });

      this.logger.log(`Publication created successfully: ${publication.id}`);
    } catch (error) {
      this.logger.error(`Failed to create publication from message ${message.messageId}:`, error);
    }
  }

  async processIncomingMessage(message: TelegramMessage): Promise<void> {
    this.logger.log(`Processing incoming message: ${message.messageId}`);

    // Only process messages with text content
    if (!message.text) {
      this.logger.log(`Message ${message.messageId} has no text content, skipping`);
      return;
    }

    // Check if message contains hashtags
    const hashtags = this.messageProcessor.extractHashtags(message.text);
    if (hashtags.length === 0) {
      this.logger.log(`Message ${message.messageId} has no hashtags, skipping`);
      return;
    }

    // Create publication
    await this.createPublicationFromMessage(message);
  }
}
