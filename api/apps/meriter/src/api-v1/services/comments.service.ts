import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Comment, CommentDocument } from '../models/comment.model';
import { PaginationHelper, PaginationResult } from '../../common/helpers/pagination.helper';
import { CreateCommentDto } from '../types/domain.types';
import { uid } from 'uid';

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    @InjectModel(Comment.name) private commentModel: Model<CommentDocument>,
  ) {}

  async createComment(createDto: CreateCommentDto, userId: string): Promise<Comment> {
    const comment = new this.commentModel({
      uid: uid(8),
      publicationId: createDto.publicationId,
      parentCommentId: createDto.parentCommentId,
      authorId: userId,
      content: createDto.content,
      upthanks: 0,
      downthanks: 0,
      score: 0,
    });

    return comment.save();
  }

  async getComment(id: string): Promise<Comment | null> {
    return this.commentModel.findOne({ uid: id }).exec();
  }

  async updateComment(id: string, updateDto: Partial<CreateCommentDto>): Promise<Comment | null> {
    const comment = await this.commentModel.findOneAndUpdate(
      { uid: id },
      { 
        ...updateDto,
        updatedAt: new Date(),
      },
      { new: true }
    ).exec();

    return comment;
  }

  async deleteComment(id: string): Promise<boolean> {
    const result = await this.commentModel.deleteOne({ uid: id }).exec();
    return result.deletedCount > 0;
  }

  async getComments(pagination: any, filters: any): Promise<PaginationResult<Comment>> {
    const skip = PaginationHelper.getSkip(pagination);
    
    const query: any = {};
    
    if (filters.publicationId) {
      query.publicationId = filters.publicationId;
    }
    
    if (filters.userId) {
      query.authorId = filters.userId;
    }

    const comments = await this.commentModel
      .find(query)
      .skip(skip)
      .limit(pagination.limit)
      .sort({ createdAt: -1 })
      .exec();

    const total = await this.commentModel.countDocuments(query);

    return PaginationHelper.createResult(comments, total, pagination);
  }

  async getPublicationComments(
    publicationId: string,
    pagination: any,
  ): Promise<PaginationResult<Comment>> {
    const skip = PaginationHelper.getSkip(pagination);

    const comments = await this.commentModel
      .find({ publicationId })
      .skip(skip)
      .limit(pagination.limit)
      .sort({ createdAt: -1 })
      .exec();

    const total = await this.commentModel.countDocuments({ publicationId });

    return PaginationHelper.createResult(comments, total, pagination);
  }

  async getCommentReplies(
    commentId: string,
    pagination: any,
  ): Promise<PaginationResult<Comment>> {
    const skip = PaginationHelper.getSkip(pagination);

    const replies = await this.commentModel
      .find({ parentCommentId: commentId })
      .skip(skip)
      .limit(pagination.limit)
      .sort({ createdAt: -1 })
      .exec();

    const total = await this.commentModel.countDocuments({ parentCommentId: commentId });

    return PaginationHelper.createResult(replies, total, pagination);
  }

  async getUserComments(userId: string, pagination: any): Promise<PaginationResult<Comment>> {
    const skip = PaginationHelper.getSkip(pagination);

    const comments = await this.commentModel
      .find({ authorId: userId })
      .skip(skip)
      .limit(pagination.limit)
      .sort({ createdAt: -1 })
      .exec();

    const total = await this.commentModel.countDocuments({ authorId: userId });

    return PaginationHelper.createResult(comments, total, pagination);
  }

  async updateCommentMetrics(commentId: string, upthanks: number, downthanks: number): Promise<void> {
    const score = upthanks - downthanks;
    
    await this.commentModel.updateOne(
      { uid: commentId },
      { 
        upthanks,
        downthanks,
        score,
        updatedAt: new Date(),
      }
    ).exec();
  }
}
