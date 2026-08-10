export const PROJECT_PARENT_LINK_REQUEST_PERSISTENCE_PORT = Symbol(
  'PROJECT_PARENT_LINK_REQUEST_PERSISTENCE_PORT',
);

export interface ProjectParentLinkRequestRecord {
  id: string;
  projectId: string;
  targetParentCommunityId: string;
  requesterUserId: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
  [key: string]: unknown;
}

export interface ProjectParentLinkRequestPersistencePort {
  create(input: Record<string, unknown>): Promise<ProjectParentLinkRequestRecord>;

  findById(requestId: string): Promise<ProjectParentLinkRequestRecord | null>;

  findPendingByProject(
    projectId: string,
  ): Promise<ProjectParentLinkRequestRecord | null>;

  listPendingForTargetParent(
    targetParentCommunityId: string,
  ): Promise<ProjectParentLinkRequestRecord[]>;

  listPendingByRequester(
    requesterUserId: string,
  ): Promise<ProjectParentLinkRequestRecord[]>;

  updateById(
    requestId: string,
    set: Record<string, unknown>,
  ): Promise<ProjectParentLinkRequestRecord | null>;

  updateMany(
    filter: Record<string, unknown>,
    set: Record<string, unknown>,
  ): Promise<void>;
}
