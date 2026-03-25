import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ProjectParentLinkRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export interface ProjectParentLinkRequest {
  id: string;
  projectId: string;
  targetParentCommunityId: string;
  requesterUserId: string;
  status: ProjectParentLinkRequestStatus;
  createdAt: Date;
  updatedAt: Date;
  resolvedByUserId?: string;
  rejectionReason?: string;
}

@Schema({ collection: 'project_parent_link_requests', timestamps: true })
export class ProjectParentLinkRequestSchemaClass implements ProjectParentLinkRequest {
  @Prop({ required: true, unique: true })
  id!: string;

  @Prop({ required: true })
  projectId!: string;

  @Prop({ required: true, index: true })
  targetParentCommunityId!: string;

  @Prop({ required: true, index: true })
  requesterUserId!: string;

  @Prop({
    required: true,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending',
    index: true,
  })
  status!: ProjectParentLinkRequestStatus;

  @Prop()
  resolvedByUserId?: string;

  @Prop()
  rejectionReason?: string;

  @Prop({ required: true })
  createdAt!: Date;

  @Prop({ required: true })
  updatedAt!: Date;
}

export const ProjectParentLinkRequestSchema = SchemaFactory.createForClass(
  ProjectParentLinkRequestSchemaClass,
);
export type ProjectParentLinkRequestDocument = ProjectParentLinkRequestSchemaClass & Document;

export const ProjectParentLinkRequest = ProjectParentLinkRequestSchemaClass;

/** At most one pending request per project. */
ProjectParentLinkRequestSchema.index(
  { projectId: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } },
);

ProjectParentLinkRequestSchema.index({ targetParentCommunityId: 1, status: 1 });
