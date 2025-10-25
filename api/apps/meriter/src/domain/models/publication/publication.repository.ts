import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseRepository } from '../../repositories/base.repository';
import { Publication, PublicationDocument } from './publication.schema';

@Injectable()
export class PublicationRepository extends BaseRepository<Publication> {
  constructor(@InjectModel(Publication.name) model: Model<PublicationDocument>) {
    super(model);
  }

  async findByCommunity(communityId: string, limit: number = 20, skip: number = 0): Promise<Publication[]> {
    return this.find(
      { communityId },
      { limit, skip, sort: { createdAt: -1 } }
    );
  }

  async findByAuthor(authorId: string, limit: number = 20, skip: number = 0): Promise<Publication[]> {
    return this.find(
      { authorId },
      { limit, skip, sort: { createdAt: -1 } }
    );
  }

  async findByHashtag(hashtag: string, limit: number = 20, skip: number = 0): Promise<Publication[]> {
    return this.find(
      { hashtags: hashtag },
      { limit, skip, sort: { 'metrics.score': -1 } }
    );
  }

  async findByScore(limit: number = 20, skip: number = 0): Promise<Publication[]> {
    return this.find(
      {},
      { limit, skip, sort: { 'metrics.score': -1 } }
    );
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
