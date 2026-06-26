import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { uid } from 'uid';
import {
  UserAuthIdentitySchemaClass,
  UserAuthIdentityDocument,
} from '../../domain/models/user-auth-identity/user-auth-identity.schema';
import {
  USER_AUTH_IDENTITY_PERSISTENCE_PORT,
  type UserAuthIdentityPersistencePort,
  type UserAuthIdentityRecord,
} from '../../domain/ports/user-auth-identity.persistence.port';

@Injectable()
export class UserAuthIdentityPersistenceAdapter
  implements UserAuthIdentityPersistencePort
{
  constructor(
    @InjectModel(UserAuthIdentitySchemaClass.name)
    private readonly identityModel: Model<UserAuthIdentityDocument>,
  ) {}

  async findByProviderAuth(
    provider: string,
    authId: string,
  ): Promise<UserAuthIdentityRecord | null> {
    const row = await this.identityModel.findOne({ provider, authId }).lean().exec();
    return row ? (row as UserAuthIdentityRecord) : null;
  }

  async findProvidersByUserId(userId: string): Promise<string[]> {
    const rows = await this.identityModel
      .find({ userId })
      .select({ provider: 1 })
      .lean()
      .exec();
    return [...new Set(rows.map((r) => r.provider))];
  }

  async linkIdentity(
    userId: string,
    provider: string,
    authId: string,
  ): Promise<UserAuthIdentityRecord> {
    const existing = await this.identityModel.findOne({ provider, authId }).lean().exec();
    if (existing) {
      if (existing.userId !== userId) {
        throw new ConflictException(
          `Identity ${provider}:${authId} is already linked to another account`,
        );
      }
      return existing as UserAuthIdentityRecord;
    }

    const now = new Date();
    const created = await this.identityModel.create({
      id: uid(),
      userId,
      provider,
      authId,
      linkedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    return created.toObject() as UserAuthIdentityRecord;
  }

  async countAll(): Promise<number> {
    return this.identityModel.countDocuments().exec();
  }

  async bulkInsertFromLegacyUsers(
    rows: Array<{ userId: string; provider: string; authId: string }>,
  ): Promise<number> {
    if (rows.length === 0) {
      return 0;
    }
    const now = new Date();
    const ops = rows.map((row) => ({
      updateOne: {
        filter: { provider: row.provider, authId: row.authId },
        update: {
          $setOnInsert: {
            id: uid(),
            userId: row.userId,
            provider: row.provider,
            authId: row.authId,
            linkedAt: now,
            createdAt: now,
            updatedAt: now,
          },
        },
        upsert: true,
      },
    }));
    const result = await this.identityModel.bulkWrite(ops, { ordered: false });
    return result.upsertedCount ?? 0;
  }
}

export const userAuthIdentityPersistenceProvider = {
  provide: USER_AUTH_IDENTITY_PERSISTENCE_PORT,
  useClass: UserAuthIdentityPersistenceAdapter,
};
