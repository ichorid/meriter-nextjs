import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ClientSession } from 'mongoose';
import { Publication, PublicationSnapshot } from '../../aggregates/publication/publication.entity';
import { PublicationId, CommunityId } from '../../value-objects';
import { Publication as PublicationSchema, PublicationDocument } from './publication.schema';

export interface IPublicationRepository {
  save(publication: Publication, session?: ClientSession): Promise<void>;
  findById(id: PublicationId, session?: ClientSession): Promise<Publication | null>;
  findByCommunity(communityId: CommunityId, limit: number, skip: number): Promise<Publication[]>;
  findRecent(limit: number, skip: number): Promise<Publication[]>;
}

@Injectable()
export class PublicationRepositoryV2 implements IPublicationRepository {
  constructor(@InjectModel(PublicationSchema.name) private model: Model<PublicationDocument>) {}

  async save(publication: Publication, session?: ClientSession): Promise<void> {
    const snapshot = publication.toSnapshot();
    await this.model.updateOne(
      { id: snapshot.id },
      { $set: snapshot },
      { upsert: true, session }
    );
  }

  async findById(id: PublicationId, session?: ClientSession): Promise<Publication | null> {
    const doc = await this.model
      .findOne({ id: id.getValue() }, null, { session })
      .lean()
      .exec();
    
    return doc ? this.toDomain(doc) : null;
  }

  async findByCommunity(communityId: CommunityId, limit: number = 20, skip: number = 0): Promise<Publication[]> {
    const docs = await this.model
      .find({ communityId: communityId.getValue() }, null, { limit, skip, sort: { createdAt: -1 } })
      .lean()
      .exec();
    
    return docs.map(doc => this.toDomain(doc));
  }

  async findRecent(limit: number = 20, skip: number = 0): Promise<Publication[]> {
    const docs = await this.model
      .find({}, null, { limit, skip, sort: { createdAt: -1 } })
      .lean()
      .exec();
    
    return docs.map(doc => this.toDomain(doc));
  }

  private toDomain(doc: any): Publication {
    return Publication.fromSnapshot(doc as PublicationSnapshot);
  }
}
