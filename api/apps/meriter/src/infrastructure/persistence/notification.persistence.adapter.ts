import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  NotificationSchemaClass,
  NotificationDocument,
} from '../../domain/models/notification/notification.schema';
import {
  NOTIFICATION_PERSISTENCE_PORT,
  type CreateNotificationInput,
  type EditorPostDeduplicationKey,
  type NotificationDeduplicationKey,
  type NotificationListQuery,
  type NotificationPersistencePort,
  type NotificationRecord,
  type NotificationType,
  type ReplaceNotificationInput,
  type TeamJoinRequestResolutionUpdate,
  type VoteAggregationKey,
} from '../../domain/ports/notification.persistence.port';
import {
  mapNotificationDocumentToRecord,
  mapNotificationRecordToDocument,
} from './mappers/notification.mapper';

@Injectable()
export class NotificationPersistenceAdapter implements NotificationPersistencePort {
  constructor(
    @InjectModel(NotificationSchemaClass.name)
    private readonly notificationModel: Model<NotificationDocument>,
  ) {}

  async create(input: CreateNotificationInput): Promise<NotificationRecord> {
    const created = await this.notificationModel.create(mapNotificationRecordToDocument(input));
    return mapNotificationDocumentToRecord(created.toObject() as NotificationRecord);
  }

  async findOldestUnreadByTarget(
    userId: string,
    type: NotificationType,
    key: NotificationDeduplicationKey,
  ): Promise<NotificationRecord | null> {
    const doc = await this.notificationModel
      .findOne({
        userId,
        type,
        read: false,
        'metadata.targetType': key.targetType,
        'metadata.targetId': key.targetId,
      })
      .sort({ createdAt: 1 })
      .lean()
      .exec();
    return doc ? mapNotificationDocumentToRecord(doc as NotificationRecord) : null;
  }

  async findOldestUnreadByEditorAndPost(
    userId: string,
    type: NotificationType,
    key: EditorPostDeduplicationKey,
  ): Promise<NotificationRecord | null> {
    const doc = await this.notificationModel
      .findOne({
        userId,
        type,
        read: false,
        'metadata.publicationId': key.publicationId,
        'metadata.editorId': key.editorId,
      })
      .sort({ createdAt: 1 })
      .lean()
      .exec();
    return doc ? mapNotificationDocumentToRecord(doc as NotificationRecord) : null;
  }

  async findOldestUnreadVoteAggregation(
    userId: string,
    key: VoteAggregationKey,
  ): Promise<NotificationRecord | null> {
    const doc = await this.notificationModel
      .findOne({
        userId,
        type: 'vote',
        read: false,
        'metadata.publicationId': key.publicationId,
        'metadata.targetType': 'publication',
      })
      .sort({ createdAt: 1 })
      .lean()
      .exec();
    return doc ? mapNotificationDocumentToRecord(doc as NotificationRecord) : null;
  }

  async replaceNotification(
    id: string,
    input: ReplaceNotificationInput,
  ): Promise<NotificationRecord> {
    const doc = await this.notificationModel
      .findOneAndUpdate(
        { id },
        {
          $set: {
            ...input,
            read: false,
            readAt: undefined,
          },
          $unset: { readAt: '' },
        },
        { new: true },
      )
      .lean()
      .exec();
    if (!doc) {
      throw new Error(`Notification ${id} not found`);
    }
    return mapNotificationDocumentToRecord(doc as NotificationRecord);
  }

  async findByUser(query: NotificationListQuery): Promise<{
    items: NotificationRecord[];
    total: number;
  }> {
    const mongoQuery: Record<string, unknown> = { userId: query.userId };
    if (query.unreadOnly) {
      mongoQuery.read = false;
    }
    if (query.type) {
      mongoQuery.type = query.type;
    }

    const [total, items] = await Promise.all([
      this.notificationModel.countDocuments(mongoQuery),
      this.notificationModel
        .find(mongoQuery)
        .sort({ createdAt: -1 })
        .skip(query.skip)
        .limit(query.limit)
        .lean()
        .exec(),
    ]);

    return {
      items: items.map((doc) => mapNotificationDocumentToRecord(doc as NotificationRecord)),
      total,
    };
  }

  async countUnread(userId: string): Promise<number> {
    return this.notificationModel.countDocuments({ userId, read: false });
  }

  async markAsRead(userId: string, notificationId: string): Promise<boolean> {
    const result = await this.notificationModel.updateOne(
      { id: notificationId, userId },
      {
        $set: {
          read: true,
          readAt: new Date(),
          updatedAt: new Date(),
        },
      },
    );
    return result.matchedCount > 0;
  }

  async markAllAsRead(userId: string): Promise<number> {
    const result = await this.notificationModel.updateMany(
      { userId, read: false },
      {
        $set: {
          read: true,
          readAt: new Date(),
          updatedAt: new Date(),
        },
      },
    );
    return result.modifiedCount;
  }

  async markTeamJoinRequestResolved(params: TeamJoinRequestResolutionUpdate): Promise<number> {
    const result = await this.notificationModel.updateMany(
      { type: 'team_join_request', 'metadata.requestId': params.requestId },
      {
        $set: {
          'metadata.joinRequestResolved': true,
          'metadata.joinRequestResolution': params.resolution,
          'metadata.resolvedByUserId': params.resolvedByUserId,
          'metadata.resolvedByDisplayName': params.resolvedByDisplayName,
          'metadata.joinRequestResolvedByUserId': params.resolvedByUserId,
          'metadata.joinRequestResolvedByName': params.resolvedByDisplayName,
          updatedAt: new Date(),
        },
      },
    );
    return result.modifiedCount;
  }
}

export const notificationPersistenceProvider = {
  provide: NOTIFICATION_PERSISTENCE_PORT,
  useClass: NotificationPersistenceAdapter,
};
