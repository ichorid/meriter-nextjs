import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Poll, PollDocument } from './poll.schema';

@Injectable()
export class PollRepository {
  constructor(@InjectModel(Poll.name) private readonly model: Model<PollDocument>) {}

  async findById(id: string): Promise<Poll | null> {
    return this.model.findById(id).lean().exec();
  }

  async findByCommunity(communityId: string, limit: number = 20, skip: number = 0): Promise<Poll[]> {
    return this.model
      .find({ communityId, isActive: true })
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  async findActive(limit: number = 20, skip: number = 0): Promise<Poll[]> {
    return this.model
      .find({ isActive: true, expiresAt: { $gt: new Date() } })
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  async create(pollData: Partial<Poll>): Promise<Poll> {
    const poll = await this.model.create(pollData);
    return poll.toObject();
  }

  async update(id: string, updateData: Partial<Poll>): Promise<Poll | null> {
    const poll = await this.model.findByIdAndUpdate(id, updateData, { new: true }).lean().exec();
    return poll;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.model.deleteOne({ _id: id }).exec();
    return result.deletedCount > 0;
  }

  async findExpired(): Promise<Poll[]> {
    return this.model.find({ isActive: true, expiresAt: { $lte: new Date() } }).lean().exec();
  }
}
