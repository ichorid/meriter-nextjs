export const TICKET_PERSISTENCE_PORT = Symbol('TICKET_PERSISTENCE_PORT');

export interface TicketApplicantRecord {
  userId: string;
  appliedAt: Date;
  status: 'pending' | 'approved' | 'rejected';
  notes?: string;
}

export interface TicketCommentRecord {
  userId: string;
  text: string;
  createdAt: Date;
}

export interface TicketRecord {
  id: string;
  title: string;
  communityId: string;
  authorId: string;
  status?: string;
  postType?: string;
  ticketProjectId?: string;
  ticketAssigneeId?: string | null;
  ticketResolvedAt?: Date | null;
  ticketResolution?: string | null;
  ticketCloseReason?: string | null;
  ticketCompletedAt?: Date | null;
  ticketArchivedAt?: Date | null;
  closeReason?: string | null;
  rating?: number;
  internalMerits?: number;
  applicants?: TicketApplicantRecord[];
  ticketComments?: TicketCommentRecord[];
  createdAt?: Date;
  updatedAt?: Date;
  [key: string]: unknown;
}

export interface TicketMutableRecord extends TicketRecord {
  save(): Promise<void>;
  set(path: string, value: unknown): void;
}

export interface TicketPersistencePort {
  create(input: Record<string, unknown>): Promise<TicketRecord>;

  findOne(filter: Record<string, unknown>): Promise<TicketMutableRecord | null>;

  findOneLean(
    filter: Record<string, unknown>,
    select?: Record<string, 0 | 1 | boolean> | string,
  ): Promise<TicketRecord | null>;

  findMany(
    filter: Record<string, unknown>,
    options?: {
      sort?: Record<string, 1 | -1>;
      skip?: number;
      limit?: number;
    },
  ): Promise<TicketRecord[]>;

  updateOne(
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
  ): Promise<void>;

  aggregateProjectContributors(
    projectId: string,
  ): Promise<Array<{ _id: string; internalMerits: number }>>;
}
