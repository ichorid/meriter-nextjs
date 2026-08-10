import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CommentSchemaClass,
  CommentDocument,
} from '../../domain/models/comment/comment.schema';
import {
  COMMENT_PERSISTENCE_PORT,
  type CommentPersistencePort,
  type CommentRecord,
  type CommentRepliesQuery,
  type CommentTargetQuery,
  type CreateAutoCommentInput,
} from '../../domain/ports/comment.persistence.port';

@Injectable()
export class CommentPersistenceAdapter implements CommentPersistencePort {
  constructor(
    @InjectModel(CommentSchemaClass.name)
    private readonly commentModel: Model<CommentDocument>,
  ) {}

  async create(snapshot: CommentRecord): Promise<void> {
    await this.commentModel.create(snapshot);
  }

  async createAutoComment(input: CreateAutoCommentInput): Promise<void> {
    await this.commentModel.create({
      id: input.id,
      targetType: 'publication',
      targetId: input.targetId,
      authorId: input.authorId,
      content: input.content,
      metrics: { upvotes: 0, downvotes: 0, score: 0, replyCount: 0 },
      isAutoComment: true,
      meritTransferId: input.meritTransferId,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
    });
  }

  async findById(id: string): Promise<CommentRecord | null> {
    const doc = await this.commentModel.findOne({ id }).lean().exec();
    return doc ? (doc as CommentRecord) : null;
  }

  async findByTarget(query: CommentTargetQuery): Promise<CommentRecord[]> {
    const docs = await this.commentModel
      .find({ targetType: query.targetType, targetId: query.targetId })
      .limit(query.limit)
      .skip(query.skip)
      .sort(query.sort)
      .lean()
      .exec();
    return docs as CommentRecord[];
  }

  async findReplies(query: CommentRepliesQuery): Promise<CommentRecord[]> {
    const docs = await this.commentModel
      .find({
        $or: [
          { parentCommentId: query.commentId },
          { targetType: 'comment', targetId: query.commentId },
        ],
      })
      .limit(query.limit)
      .skip(query.skip)
      .sort(query.sort)
      .lean()
      .exec();
    return docs as CommentRecord[];
  }

  async findByAuthor(userId: string, limit: number, skip: number): Promise<CommentRecord[]> {
    const docs = await this.commentModel
      .find({ authorId: userId })
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return docs as CommentRecord[];
  }

  async findPublicationAutoComments(publicationId: string, max: number): Promise<CommentRecord[]> {
    const rows = await this.commentModel
      .find({
        targetType: 'publication',
        targetId: publicationId,
        isAutoComment: true,
      })
      .sort({ createdAt: -1 })
      .limit(max)
      .lean()
      .exec();
    return rows as CommentRecord[];
  }

  async updateSnapshot(id: string, snapshot: CommentRecord): Promise<void> {
    await this.commentModel.updateOne({ id }, { $set: snapshot });
  }

  async updateContent(
    id: string,
    content: string,
    updatedAt: Date,
  ): Promise<CommentRecord | null> {
    await this.commentModel.updateOne({ id }, { $set: { content, updatedAt } });
    return this.findById(id);
  }

  async deleteById(id: string): Promise<void> {
    await this.commentModel.deleteOne({ id });
  }
}

export const commentPersistenceProvider = {
  provide: COMMENT_PERSISTENCE_PORT,
  useClass: CommentPersistenceAdapter,
};
