import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PublicationService } from '../domain/services/publication.service';
import { CommunitySchemaClass, CommunityDocument } from '../domain/models/community/community.schema';
import type { _Community } from '../domain/models/community/community.schema';
import { UserSchemaClass, UserDocument } from '../domain/models/user/user.schema';
import type { _User } from '../domain/models/user/user.schema';
import { TelegramMessageProcessorService, _ParsedMessage } from './message-processor.service';
import { TelegramMessage } from './message-processor.service';
import { uid } from 'uid';

@Injectable()
export class TelegramPublicationCreatorService {
  private readonly logger = new Logger(TelegramPublicationCreatorService.name);

  constructor(
    private publicationService: PublicationService,
    @InjectModel(CommunitySchemaClass.name) private communityModel: Model<CommunityDocument>,
    @InjectModel(UserSchemaClass.name) private userModel: Model<UserDocument>,
    private messageProcessor: TelegramMessageProcessorService,
  ) { }

  async createPublicationFromMessage(message: TelegramMessage): Promise<void> {
    this.logger.log(`Creating publication from message: ${message.messageId}`);

    // Parse the message
    const parsedMessage = this.messageProcessor.parseMessage(message);

    // Find community by chatId (telegram chat ID)
    const community = await this.communityModel.findOne({ 
      $or: [
        { id: String(message.chatId) },
        { 'settings.telegramChatId': String(message.chatId) }
      ]
    }).lean();
    if (!community) {
      this.logger.warn(`Community not found for chat: ${message.chatId}`);
      return;
    }

    // Validate message has valid hashtags
    if (!this.messageProcessor.isValidPublicationMessage(parsedMessage, community.hashtags)) {
      this.logger.log(`Message ${message.messageId} has no valid hashtags, skipping`);
      return;
    }

    // Find or create user by telegram authId
    let user = await this.userModel.findOne({ 
      authProvider: 'telegram', 
      authId: String(message.userId) 
    }).lean();
    if (!user) {
      this.logger.log(`Creating new user: ${message.userId}`);
      await this.userModel.create({
        id: uid(),
        authProvider: 'telegram',
        authId: String(message.userId),
        displayName: `User ${message.userId}`, // Default display name
        username: undefined,
        profile: {},
        communityTags: [],
        communityMemberships: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      user = await this.userModel.findOne({ 
        authProvider: 'telegram', 
        authId: String(message.userId) 
      }).lean();
      if (!user) {
        this.logger.error(`Failed to create user: ${message.userId}`);
        return;
      }
    }

    // Find beneficiary if specified
    let beneficiaryId: string | undefined;
    if (parsedMessage.beneficiary) {
      const beneficiary = await this.userModel.findOne({ username: parsedMessage.beneficiary.username || '' }).lean();
      if (beneficiary) {
        beneficiaryId = beneficiary.id;
      } else {
        this.logger.warn(`Beneficiary not found: ${parsedMessage.beneficiary.username}`);
      }
    }

    // Determine message type
    const messageType = this.messageProcessor.determineMessageType(message);

    // Create publication - use user.id
    if (!user) {
      this.logger.error(`User not found or created for userId: ${message.userId}`);
      return;
    }
    
    try {
      const publication = await this.publicationService.createPublication(user.id, {
        communityId: community.id, // Use MongoDB document ID
        content: parsedMessage.cleanedText,
        type: messageType,
        beneficiaryId,
        hashtags: parsedMessage.hashtags,
        imageUrl: message.photo?.[0], // Use first photo if available
        videoUrl: message.video,
      });

      this.logger.log(`Publication created successfully: ${publication.getId.getValue()}`);
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