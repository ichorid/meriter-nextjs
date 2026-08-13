import { UzzRepositories } from './uzz-repositories';

export const UZZ_UNIT_OF_WORK = Symbol('UZZ_UNIT_OF_WORK');

export interface UzzUnitOfWork {
  run<T>(work: (repositories: UzzRepositories) => Promise<T>): Promise<T>;
}

