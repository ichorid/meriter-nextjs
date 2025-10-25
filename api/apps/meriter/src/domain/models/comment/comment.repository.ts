import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseRepository } from '../../repositories/base.repository';
import { Comment, CommentDocument } from './comment.schema';

@Injectable()
export class CommentRepository extends BaseRepository<Comment> {
  constructor(@InjectModel(Comment.name) model: Model<CommentDocument>) {
    super(model);
  }

  async findByTarget(targetType: string, targetId: string, limit: number = 50, skip: number = 0): Promise<Comment[]> {
    return this.find(
      { targetType, targetId },
      { limit, skip, sort: { createdAt: -1 } }
    );
  }

  async findByAuthor(authorId: string, limit: number = 50, skip: number = 0): Promise<Comment[]> {
    return this.find(
      { authorId },
      { limit, skip, sort: { createdAt: -1 } }
    );
  }

  async findReplies(parentCommentId: string, limit: number = 20, skip: number = 0): Promise<Comment[]> {
    return this.find(
      { parentCommentId },
      { limit, skip, sort: { createdAt: -1 } }
    );
  }

  async updateMetrics(id: string, delta: number): Promise<Comment | null> {
    const comment = await this.model.findById(id);
    if (!comment) return null;

    if (delta > 0) {
      comment.metrics.upthanks += delta;
    } else {
      comment.metrics.downthanks += Math.abs(delta);
    }
    comment.metrics.score = comment.metrics.upthanks - comment.metrics.downthanks;
    
    await comment.save();
    return comment.toObject();
  }

  async incrementReplyCount(id: string): Promise<Comment | null> {
    return this.model.findByIdAndUpdate(
      id,
      { $inc: { 'metrics.replyCount': 1 } },
      { new: true }
    ).lean().exec();
  }
}
