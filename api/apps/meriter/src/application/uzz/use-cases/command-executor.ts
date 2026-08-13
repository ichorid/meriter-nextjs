import { UzzConflictError } from '../../../domain/uzz/errors';
import { UzzRepositories } from '../ports/uzz-repositories';
import { UzzUnitOfWork } from '../ports/uzz-unit-of-work';

export class CommandExecutor {
  constructor(private readonly unitOfWork: UzzUnitOfWork) {}

  async execute<T>(input: {
    commandId: string;
    actorId: string;
    type: string;
    work: (repositories: UzzRepositories) => Promise<T>;
  }): Promise<T> {
    return this.unitOfWork.run(async (repositories) => {
      const existing = await repositories.commands.findById(input.commandId);
      if (existing?.status === 'completed') {
        return existing.result as T;
      }
      if (existing) {
        throw new UzzConflictError('COMMAND_ALREADY_RUNNING');
      }

      const now = new Date();
      const command = {
        commandId: input.commandId,
        actorId: input.actorId,
        type: input.type,
        status: 'started' as const,
        createdAt: now,
        updatedAt: now,
      };
      await repositories.commands.insert(command);
      const result = await input.work(repositories);
      await repositories.commands.update({
        ...command,
        status: 'completed',
        result,
        updatedAt: new Date(),
      });
      return result;
    });
  }
}

