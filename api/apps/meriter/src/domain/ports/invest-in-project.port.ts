/**
 * Orchestration port (BC-08): invest into a cooperative project pool (non-member path).
 * Implemented in application (InvestInProjectUseCase), wired at the composition root
 * (Zone 8 inversion).
 */
export const INVEST_IN_PROJECT_PORT = Symbol('INVEST_IN_PROJECT_PORT');

export type InvestInProjectInput = {
  userId: string;
  projectId: string;
  amount: number;
};

export interface InvestInProjectPort {
  execute(input: InvestInProjectInput): Promise<void>;
}
