import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Publication, PublicationDocument } from './publication.schema';

@Injectable()
export class PublicationRepository {
  constructor(@InjectModel(Publication.name) private readonly model: Model<PublicationDocument>) {}

  async findByCommunity(communityId: string, limit: number = 20, skip: number = 0): Promise<Publication[]> {
    return this.model
      .find({ communityId })
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  async findByAuthor(authorId: string, limit: number = 20, skip: number = 0): Promise<Publication[]> {
    return this.model
      .find({ authorId })
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  async findByHashtag(hashtag: string, limit: number = 20, skip: number = 0): Promise<Publication[]> {
    return this.model
      .find({ hashtags: hashtag })
      .limit(limit)
      .skip(skip)
      .sort({ 'metrics.score': -1 })
      .lean()
      .exec();
  }

  async findByScore(limit: number = 20, skip: number = 0): Promise<Publication[]> {
    return this.model
      .find({})
      .limit(limit)
      .skip(skip)
      .sort({ 'metrics.score': -1 })
      .lean()
      .exec();
  }

  async findById(id: string): Promise<Publication | null> {
    return this.model.findById(id).lean().exec();
  }

  async updateMetrics(id: string, delta: number): Promise<Publication | null> {
    const publication = await this.model.findById(id);
    if (!publication) return null;

    if (delta > 0) {
      publication.metrics.upthanks += delta;
    } else {
      publication.metrics.downthanks += Math.abs(delta);
    }
    publication.metrics.score = publication.metrics.upthanks - publication.metrics.downthanks;
    
    await publication.save();
    return publication.toObject();
  }

  async incrementCommentCount(id: string): Promise<Publication | null> {
    return this.model.findByIdAndUpdate(
      id,
      { $inc: { 'metrics.commentCount': 1 } },
      { new: true }
    ).lean().exec();
  }
}
