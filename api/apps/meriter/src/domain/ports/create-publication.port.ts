import type { Publication } from '../aggregates/publication/publication.entity';
import type { CreatePublicationDto } from '../services/publication.service';

/**
 * Orchestration port (BC-02): create a publication (permission + post-cost orchestration).
 * Implemented in application (CreatePublicationUseCase), wired at the composition root
 * (Zone 8 inversion).
 */
export const CREATE_PUBLICATION_PORT = Symbol('CREATE_PUBLICATION_PORT');

export type CreatePublicationExecuteOptions = {
  /** When true (default), enforce canCreatePublication before side effects (inv-08). */
  checkPermissions?: boolean;
  /**
   * When true, deduct postCost (inv-01 global wallet burn / quota / community wallet).
   * Default false so legacy callers and interim publications.create router path avoid double charge.
   */
  processPostCost?: boolean;
};

export interface CreatePublicationPort {
  execute(
    userId: string,
    dto: CreatePublicationDto,
    options?: CreatePublicationExecuteOptions,
  ): Promise<Publication>;
}
