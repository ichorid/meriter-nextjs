import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { Document, FilterQuery, Model, UpdateQuery } from 'mongoose';
import {
  Agreement,
  AgreementDocument,
} from '@common/abstracts/agreements/schema/agreement.schema';

@Injectable()
export class AgreementsService {
  constructor(
    @InjectModel(Agreement.name)
    private agreementModel: Model<AgreementDocument>,
  ) {
    this.model = agreementModel;
  }

  model: Model<AgreementDocument>;

  async find(condition: FilterQuery<AgreementDocument>) {
    return this.agreementModel.find(condition);
  }

  async upsert(
    domainName,
    condition: FilterQuery<AgreementDocument>,
    data: UpdateQuery<AgreementDocument>,
  ) {
    const res = await this.agreementModel.findOneAndUpdate(
      { ...condition, domainName },
      { ...data, domainName },
      { new: true, upsert: true },
    );

    return res;
  }

  focusUriExtractUid(focusUri: string) {
    if (focusUri.match('://slug')) throw 'uri type mismatch. Slug prefix found';
    return focusUri.split('://')?.[1];
  }

  __testCleanup() {
    return this.agreementModel.deleteMany({});
  }
}
