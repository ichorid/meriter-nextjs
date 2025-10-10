import { Injectable } from '@nestjs/common';

import { FilterQuery, Model, QueryOptions } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import {
  Asset,
  AssetDocument,
} from '@common/abstracts/assets/schema/asset.schema';

@Injectable()
export class AssetsService {
  constructor(
    @InjectModel(Asset.name) private assetModel: Model<AssetDocument>,
  ) {
    this.model = assetModel;
  }

  model: Model<AssetDocument>;

  async upsert(
    domainName: string,
    condition: Record<string, unknown>,
    data: Record<string, unknown>,
  ) {
    return this.assetModel.findOneAndUpdate(
      { ...condition, domainName },
      { ...data, domainName },
      { new: true, upsert: true },
    );
  }

  async find(
    condition: FilterQuery<AssetDocument>,
    projection?: any,
    options?: QueryOptions,
  ) {
    return this.assetModel.find(condition, projection, options);
  }

  async getByShortUid(shortUid: string) {
    return (await this.assetModel.findOne({ shortUid })).toObject();
  }

  async getByLongUid(longUid: string) {
    return (await this.assetModel.findOne({ longUid })).toObject();
  }
  async getByMeta(meta: Record<string, unknown>) {
    return (await this.assetModel.findOne({ meta })).toObject();
  }

  async uploadFile() {}

  __testCleanup() {
    return this.assetModel.deleteMany({});
  }
}
