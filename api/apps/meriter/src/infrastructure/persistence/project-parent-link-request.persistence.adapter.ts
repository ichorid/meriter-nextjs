import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ProjectParentLinkRequestSchemaClass,
  ProjectParentLinkRequestDocument,
} from '../../domain/models/project-parent-link-request/project-parent-link-request.schema';
import {
  PROJECT_PARENT_LINK_REQUEST_PERSISTENCE_PORT,
  type ProjectParentLinkRequestPersistencePort,
  type ProjectParentLinkRequestRecord,
} from '../../domain/ports/project-parent-link-request.persistence.port';

function toRecord(
  doc: ProjectParentLinkRequestDocument | Record<string, unknown>,
): ProjectParentLinkRequestRecord {
  const row =
    'toObject' in doc && typeof doc.toObject === 'function'
      ? doc.toObject()
      : doc;
  return row as ProjectParentLinkRequestRecord;
}

@Injectable()
export class ProjectParentLinkRequestPersistenceAdapter
  implements ProjectParentLinkRequestPersistencePort
{
  constructor(
    @InjectModel(ProjectParentLinkRequestSchemaClass.name)
    private readonly requestModel: Model<ProjectParentLinkRequestDocument>,
  ) {}

  async create(
    input: Record<string, unknown>,
  ): Promise<ProjectParentLinkRequestRecord> {
    const doc = await this.requestModel.create(input);
    return toRecord(doc);
  }

  async findById(
    requestId: string,
  ): Promise<ProjectParentLinkRequestRecord | null> {
    const row = await this.requestModel.findOne({ id: requestId }).lean().exec();
    return row ? (row as ProjectParentLinkRequestRecord) : null;
  }

  async findPendingByProject(
    projectId: string,
  ): Promise<ProjectParentLinkRequestRecord | null> {
    const row = await this.requestModel
      .findOne({ projectId, status: 'pending' })
      .lean()
      .exec();
    return row ? (row as ProjectParentLinkRequestRecord) : null;
  }

  async listPendingForTargetParent(
    targetParentCommunityId: string,
  ): Promise<ProjectParentLinkRequestRecord[]> {
    const rows = await this.requestModel
      .find({ targetParentCommunityId, status: 'pending' })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return rows as ProjectParentLinkRequestRecord[];
  }

  async listPendingByRequester(
    requesterUserId: string,
  ): Promise<ProjectParentLinkRequestRecord[]> {
    const rows = await this.requestModel
      .find({ requesterUserId, status: 'pending' })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return rows as ProjectParentLinkRequestRecord[];
  }

  async updateById(
    requestId: string,
    set: Record<string, unknown>,
  ): Promise<ProjectParentLinkRequestRecord | null> {
    const doc = await this.requestModel
      .findOneAndUpdate({ id: requestId }, { $set: set }, { new: true })
      .exec();
    return doc ? toRecord(doc) : null;
  }

  async updateMany(
    filter: Record<string, unknown>,
    set: Record<string, unknown>,
  ): Promise<void> {
    await this.requestModel.updateMany(filter, { $set: set }).exec();
  }
}

export const projectParentLinkRequestPersistenceProvider = {
  provide: PROJECT_PARENT_LINK_REQUEST_PERSISTENCE_PORT,
  useClass: ProjectParentLinkRequestPersistenceAdapter,
};
