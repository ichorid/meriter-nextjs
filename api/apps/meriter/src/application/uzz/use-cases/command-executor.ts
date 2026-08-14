import { createHash } from 'crypto';
import { UzzConflictError } from '../../../domain/uzz/errors';
import { UzzRepositories } from '../ports/uzz-repositories';
import { UzzUnitOfWork } from '../ports/uzz-unit-of-work';

export function hashCommandPayload(payload: unknown): string {
  return createHash('sha256').update(canonicalJson(payload), 'utf8').digest('hex');
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      const next = record[key];
      if (next !== undefined) {
        sorted[key] = canonicalize(next);
      }
    }
    return sorted;
  }
  return value;
}

export class CommandExecutor {
  constructor(private readonly unitOfWork: UzzUnitOfWork) {}

  async execute<T>(input: {
    commandId: string;
    actorId: string;
    type: string;
    payload: unknown;
    work: (repositories: UzzRepositories) => Promise<T>;
  }): Promise<T> {
    const payloadHash = hashCommandPayload(input.payload);
    return this.unitOfWork.run(async (repositories) => {
      const existing = await repositories.commands.find(input.actorId, input.commandId);
      if (existing) {
        if (existing.type !== input.type || existing.payloadHash !== payloadHash) {
          throw new UzzConflictError('COMMAND_ID_CONFLICT');
        }
        if (existing.status === 'completed') {
          return existing.result as T;
        }
        throw new UzzConflictError('COMMAND_ALREADY_RUNNING');
      }

      const now = new Date();
      const command = {
        commandId: input.commandId,
        actorId: input.actorId,
        type: input.type,
        payloadHash,
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
