import { Injectable } from '@nestjs/common';
import { ICounter } from './model/counter.interface';
import { InjectModel } from '@nestjs/mongoose';
import { Counter, CounterDocument } from './schema/counter.schema';
import { Model } from 'mongoose';

import { objectSpreadMeta } from '@common/lambdas/pure/objects';

class CounterSchema {}

@Injectable()
export class CountersService {
  constructor(
    @InjectModel(Counter.name, 'default') private counterModel: Model<CounterDocument>,
  ) {
    this.model = counterModel;
  }

  model: Model<CounterDocument>;

  async pushToCounter(
    domainName: string,
    delta: number,
    metaValue: Record<string, unknown>,
    preserveOnly?: boolean,
  ): Promise<CounterDocument> {
    return this.counterModel.findOneAndUpdate(
      objectSpreadMeta({ ...metaValue, domainName }),
      { meta: { ...metaValue, domainName }, $inc: { value: delta } },
      { upsert: true, new: true },
    );
  }

  async initCounter(
    domainName: string,
    delta: number,
    metaValue: Record<string, unknown>,
    preserveOnly?: boolean,
  ): Promise<CounterDocument> {
    if (
      !(await this.counterModel.countDocuments(
        objectSpreadMeta({ ...metaValue, domainName }),
      ))
    ) {
      return await this.pushToCounter(domainName, delta, metaValue);
    }
  }

  async getCounter(metaCondition): Promise<number> {
    return (
      (await this.counterModel.findOne(objectSpreadMeta(metaCondition)))
        ?.value ?? 0
    );
  }

  async topRecords(metaCondition, limit, skip): Promise<ICounter[]> {
    return Promise.resolve([{ value: 1, meta: {} }]);
  }

  async __testCleanup() {
    return this.counterModel.deleteMany({});
  }
}
