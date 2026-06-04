import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model } from 'mongoose';
import {
  DocumentBlockVariantSchemaClass,
  DocumentBlockVariantDocument,
} from '../../domain/models/document-block-variant/document-block-variant.schema';
import {
  MeriterDocumentSchemaClass,
  MeriterDocumentDocument,
} from '../../domain/models/meriter-document/meriter-document.schema';
import {
  DOCUMENT_WAVE_FINALIZE_LOCKS_COLLECTION,
  documentWaveFinalizeLockId,
} from '../../domain/common/constants/document-wave-lock.constants';
import {
  DocumentVotingThreadSchemaClass,
  DocumentVotingThreadDocument,
} from '../../domain/models/document-voting-thread/document-voting-thread.schema';
import {
  DOCUMENT_PERSISTENCE_PORT,
  type DocumentBlockVariantRecord,
  type DocumentBlockVariantStatus,
  type DocumentMetaUpdate,
  type DocumentOfficialSummary,
  type DocumentPersistencePort,
  type DocumentPersistenceSession,
  type DocumentSectionsUpdateResponse,
  type DocumentVotingThreadRecord,
  type InsertDocumentBlockVariantInput,
  type InsertDocumentVotingThreadInput,
  type InsertMeriterDocumentInput,
  type MeriterDocType,
  type MeriterDocumentSnapshot,
  type OpenWaveBlockPair,
} from '../../domain/ports/document.persistence.port';
import {
  mapDocumentBlockVariantRecordToDocument,
  mapDocumentBlockVariantToRecord,
  mapMeriterDocumentSnapshotToDocument,
  mapMeriterDocumentToSnapshot,
} from './mappers/document.mapper';

function sessionOpts(session?: DocumentPersistenceSession) {
  return session ? { session: session as ClientSession } : undefined;
}

@Injectable()
export class DocumentPersistenceAdapter implements DocumentPersistencePort {
  constructor(
    @InjectModel(MeriterDocumentSchemaClass.name)
    private readonly documentModel: Model<MeriterDocumentDocument>,
    @InjectModel(DocumentBlockVariantSchemaClass.name)
    private readonly variantModel: Model<DocumentBlockVariantDocument>,
    @InjectModel(DocumentVotingThreadSchemaClass.name)
    private readonly votingThreadModel: Model<DocumentVotingThreadDocument>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async startSession(): Promise<DocumentPersistenceSession> {
    return this.connection.startSession();
  }

  async insertDocument(input: InsertMeriterDocumentInput): Promise<void> {
    const now = new Date();
    await this.documentModel.create({
      ...mapMeriterDocumentSnapshotToDocument({
        ...input,
        deleted: input.deleted ?? false,
        createdAt: input.createdAt ?? now,
        updatedAt: input.updatedAt ?? now,
      }),
    });
  }

  async findDocumentById(id: string): Promise<MeriterDocumentSnapshot | null> {
    const doc = await this.documentModel.findOne({ id, deleted: false }).lean().exec();
    return doc ? mapMeriterDocumentToSnapshot(doc as MeriterDocumentSnapshot) : null;
  }

  async findOfficialByType(
    communityId: string,
    type: MeriterDocType,
  ): Promise<MeriterDocumentSnapshot | null> {
    const doc = await this.documentModel
      .findOne({ communityId, type, deleted: false })
      .lean()
      .exec();
    return doc ? mapMeriterDocumentToSnapshot(doc as MeriterDocumentSnapshot) : null;
  }

  async findActiveByCommunity(communityId: string): Promise<MeriterDocumentSnapshot[]> {
    const docs = await this.documentModel
      .find({
        communityId,
        deleted: false,
        $nor: [{ status: 'archived' }],
      })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return docs.map((doc) => mapMeriterDocumentToSnapshot(doc as MeriterDocumentSnapshot));
  }

  async findOfficialByCommunities(
    communityIds: string[],
    type: MeriterDocType,
  ): Promise<Map<string, DocumentOfficialSummary>> {
    if (communityIds.length === 0) {
      return new Map();
    }
    const docs = await this.documentModel
      .find({ communityId: { $in: communityIds }, type, deleted: false })
      .select('id communityId sections')
      .lean()
      .exec();
    return new Map(
      docs.map((doc) => [
        doc.communityId as string,
        {
          id: doc.id as string,
          sections: doc.sections as unknown[],
        },
      ]),
    );
  }

  async updateDocumentMeta(id: string, update: DocumentMetaUpdate): Promise<boolean> {
    const result = await this.documentModel.updateOne(
      { id, deleted: false },
      { $set: update },
    );
    return result.matchedCount > 0;
  }

  async updateDocumentSections(
    id: string,
    sections: unknown[],
    options?: { expectedUpdatedAt?: Date },
  ): Promise<DocumentSectionsUpdateResponse> {
    const filter: Record<string, unknown> = { id, deleted: false };
    if (options?.expectedUpdatedAt) {
      filter.updatedAt = options.expectedUpdatedAt;
    }
    const result = await this.documentModel.updateOne(filter, {
      $set: { sections, updatedAt: new Date() },
    });
    if (result.matchedCount > 0) {
      return { ok: true };
    }
    const exists = await this.documentModel.exists({ id, deleted: false });
    return { ok: false, reason: exists ? 'conflict' : 'not_found' };
  }

  async documentExists(id: string): Promise<boolean> {
    const exists = await this.documentModel.exists({ id, deleted: false });
    return !!exists;
  }

  async saveDocumentSections(
    id: string,
    sections: unknown[],
    session?: DocumentPersistenceSession,
  ): Promise<boolean> {
    const result = await this.documentModel.updateOne(
      { id, deleted: false },
      { $set: { sections, updatedAt: new Date() } },
      sessionOpts(session),
    );
    return result.matchedCount > 0;
  }

  async applyOfficialBlockRatingDelta(
    documentId: string,
    blockId: string,
    delta: number,
    session?: DocumentPersistenceSession,
  ): Promise<void> {
    if (!delta) {
      return;
    }
    const doc = await this.documentModel.findOne({ id: documentId }).exec();
    if (!doc) {
      throw new NotFoundException('Document not found');
    }
    const sections = doc.sections as Array<{
      blocks?: Array<{ id: string; officialRating?: number }>;
    }>;
    let found = false;
    for (const sec of sections ?? []) {
      for (const block of sec.blocks ?? []) {
        if (block.id === blockId) {
          block.officialRating = (block.officialRating ?? 0) + delta;
          found = true;
          break;
        }
      }
      if (found) {
        break;
      }
    }
    if (!found) {
      throw new NotFoundException('Block not found');
    }
    doc.markModified('sections');
    await doc.save(sessionOpts(session));
  }

  async findVariantById(id: string): Promise<DocumentBlockVariantRecord | null> {
    const doc = await this.variantModel.findOne({ id, deleted: false }).lean().exec();
    return doc ? mapDocumentBlockVariantToRecord(doc as DocumentBlockVariantRecord) : null;
  }

  async findVariantsByBlock(
    documentId: string,
    blockId: string,
  ): Promise<DocumentBlockVariantRecord[]> {
    const docs = await this.variantModel
      .find({ documentId, blockId, deleted: false })
      .sort({ proposedAt: -1 })
      .lean()
      .exec();
    return docs.map((doc) => mapDocumentBlockVariantToRecord(doc as DocumentBlockVariantRecord));
  }

  async findOpenVariants(
    documentId: string,
    blockId: string,
  ): Promise<DocumentBlockVariantRecord[]> {
    const docs = await this.variantModel
      .find({ documentId, blockId, status: 'open', deleted: false })
      .lean()
      .exec();
    return docs.map((doc) => mapDocumentBlockVariantToRecord(doc as DocumentBlockVariantRecord));
  }

  async findActiveVariantsByDocument(
    documentId: string,
  ): Promise<DocumentBlockVariantRecord[]> {
    const docs = await this.variantModel
      .find({
        documentId,
        deleted: false,
        status: { $in: ['open', 'closed-winner'] },
      })
      .sort({ proposedAt: -1 })
      .lean()
      .exec();
    return docs.map((doc) => mapDocumentBlockVariantToRecord(doc as DocumentBlockVariantRecord));
  }

  async findOpenVariantsByBlockIds(
    documentId: string,
    blockIds: string[],
  ): Promise<DocumentBlockVariantRecord[]> {
    if (blockIds.length === 0) {
      return [];
    }
    const docs = await this.variantModel
      .find({
        documentId,
        blockId: { $in: blockIds },
        status: 'open',
        deleted: false,
      })
      .lean()
      .exec();
    return docs.map((doc) => mapDocumentBlockVariantToRecord(doc as DocumentBlockVariantRecord));
  }

  async findVariantsPendingResolution(
    documentId: string,
    blockId: string,
  ): Promise<DocumentBlockVariantRecord[]> {
    const docs = await this.variantModel
      .find({
        documentId,
        blockId,
        deleted: false,
        status: { $in: ['open', 'closed-winner', 'closed-not-winner'] },
      })
      .lean()
      .exec();
    return docs.map((doc) => mapDocumentBlockVariantToRecord(doc as DocumentBlockVariantRecord));
  }

  async findClosedWinnerVariant(
    documentId: string,
    blockId: string,
  ): Promise<DocumentBlockVariantRecord | null> {
    const winners = await this.findClosedWinnerVariants(documentId, blockId);
    return winners[0] ?? null;
  }

  async findClosedWinnerVariants(
    documentId: string,
    blockId: string,
  ): Promise<DocumentBlockVariantRecord[]> {
    const docs = await this.variantModel
      .find({ documentId, blockId, status: 'closed-winner', deleted: false })
      .sort({ rating: -1, proposedAt: 1 })
      .lean()
      .exec();
    return docs.map((doc) => mapDocumentBlockVariantToRecord(doc as DocumentBlockVariantRecord));
  }

  async findOpenVotingThreads(
    documentId: string,
  ): Promise<DocumentVotingThreadRecord[]> {
    const docs = await this.votingThreadModel
      .find({ documentId, status: 'open' })
      .lean()
      .exec();
    return docs as DocumentVotingThreadRecord[];
  }

  async insertVotingThread(
    input: InsertDocumentVotingThreadInput,
  ): Promise<DocumentVotingThreadRecord> {
    const created = await this.votingThreadModel.create(input);
    return created.toObject() as DocumentVotingThreadRecord;
  }

  async updateVotingThread(
    threadId: string,
    patch: Partial<Pick<DocumentVotingThreadRecord, 'waveEndsAt' | 'ranges' | 'status'>>,
  ): Promise<void> {
    await this.votingThreadModel.updateOne(
      { id: threadId },
      { $set: { ...patch, updatedAt: new Date() } },
    );
  }

  async findOpenWaveBlockPairs(): Promise<OpenWaveBlockPair[]> {
    const pairs = await this.variantModel
      .aggregate<{ _id: { d: string; b: string } }>([
        { $match: { status: 'open', deleted: false } },
        { $group: { _id: { d: '$documentId', b: '$blockId' } } },
      ])
      .exec();
    return pairs.map((pair) => ({
      documentId: pair._id.d,
      blockId: pair._id.b,
    }));
  }

  async insertVariant(
    input: InsertDocumentBlockVariantInput,
  ): Promise<DocumentBlockVariantRecord> {
    const created = await this.variantModel.create(mapDocumentBlockVariantRecordToDocument(input));
    return mapDocumentBlockVariantToRecord(created.toObject() as DocumentBlockVariantRecord);
  }

  async applyVariantRatingDelta(
    variantId: string,
    delta: number,
    session?: DocumentPersistenceSession,
  ): Promise<void> {
    if (!delta) {
      return;
    }
    await this.variantModel.updateOne(
      { id: variantId },
      { $inc: { rating: delta }, $set: { updatedAt: new Date() } },
      sessionOpts(session),
    );
  }

  async updateVariantStatus(
    variantId: string,
    status: DocumentBlockVariantStatus,
    session?: DocumentPersistenceSession,
  ): Promise<void> {
    await this.variantModel.updateOne(
      { id: variantId },
      { $set: { status, updatedAt: new Date() } },
      sessionOpts(session),
    );
  }

  async updateVariantsStatusByFilter(
    filter: Record<string, unknown>,
    status: DocumentBlockVariantStatus,
    session?: DocumentPersistenceSession,
  ): Promise<void> {
    await this.variantModel.updateMany(
      filter,
      { $set: { status, updatedAt: new Date() } },
      sessionOpts(session),
    );
  }

  async markVariantApplied(
    variantId: string,
    appliedAt: Date,
    appliedBy: string,
    session?: DocumentPersistenceSession,
  ): Promise<void> {
    await this.variantModel.updateOne(
      { id: variantId },
      {
        $set: {
          status: 'applied',
          appliedAt,
          appliedBy,
          updatedAt: new Date(),
        },
      },
      sessionOpts(session),
    );
  }

  async softDeleteVariant(variantId: string): Promise<void> {
    await this.variantModel.updateOne(
      { id: variantId },
      { $set: { deleted: true, updatedAt: new Date() } },
    );
  }

  async withdrawOpenVariantsOnBlock(
    documentId: string,
    blockId: string,
    exceptVariantId?: string,
  ): Promise<void> {
    await this.variantModel.updateMany(
      {
        documentId,
        blockId,
        status: 'open',
        deleted: false,
        ...(exceptVariantId ? { id: { $ne: exceptVariantId } } : {}),
      },
      { $set: { status: 'withdrawn', updatedAt: new Date() } },
    );
  }

  async acquireWaveFinalizeLock(documentId: string, blockId: string): Promise<boolean> {
    const locks = this.connection.db?.collection(DOCUMENT_WAVE_FINALIZE_LOCKS_COLLECTION);
    if (!locks) {
      return true;
    }
    const lockId = documentWaveFinalizeLockId(documentId, blockId);
    const acquired = await locks.updateOne(
      { lockId },
      { $setOnInsert: { lockId, createdAt: new Date() } },
      { upsert: true },
    );
    return acquired.upsertedCount > 0;
  }

  async releaseWaveFinalizeLock(documentId: string, blockId: string): Promise<void> {
    const locks = this.connection.db?.collection(DOCUMENT_WAVE_FINALIZE_LOCKS_COLLECTION);
    if (!locks) {
      return;
    }
    const lockId = documentWaveFinalizeLockId(documentId, blockId);
    await locks.deleteOne({ lockId }).catch(() => undefined);
  }

  async softDeleteImageOfFutureByCommunityIds(communityIds: string[]): Promise<number> {
    if (communityIds.length === 0) {
      return 0;
    }
    const result = await this.documentModel.updateMany(
      {
        communityId: { $in: communityIds },
        type: 'imageOfFuture',
        deleted: false,
      },
      { $set: { deleted: true, updatedAt: new Date() } },
    );
    return result.modifiedCount ?? 0;
  }

  async countActiveImageOfFutureByCommunityIds(communityIds: string[]): Promise<number> {
    if (communityIds.length === 0) {
      return 0;
    }
    return this.documentModel.countDocuments({
      communityId: { $in: communityIds },
      type: 'imageOfFuture',
      deleted: false,
    });
  }

  async existsActiveByCommunityAndType(
    communityId: string,
    type: MeriterDocType,
  ): Promise<boolean> {
    const exists = await this.documentModel.exists({
      communityId,
      type,
      deleted: false,
    });
    return exists !== null;
  }
}

export const documentPersistenceProvider = {
  provide: DOCUMENT_PERSISTENCE_PORT,
  useClass: DocumentPersistenceAdapter,
};
