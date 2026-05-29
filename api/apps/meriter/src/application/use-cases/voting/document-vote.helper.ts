import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import type { ClientSession } from 'mongoose';
import { parseOfficialBlockVoteTargetId } from '../../../domain/common/document-official-vote.util';
import type { DocumentService } from '../../../domain/services/document.service';

export type DocumentVoteTargetType = 'document-variant' | 'document-block-official';

export function isDocumentVoteTargetType(
  targetType: string,
): targetType is DocumentVoteTargetType {
  return targetType === 'document-variant' || targetType === 'document-block-official';
}

export interface DocumentVoteContext {
  doc: NonNullable<Awaited<ReturnType<DocumentService['getById']>>>;
  blockId: string;
  variant?: NonNullable<Awaited<ReturnType<DocumentService['getVariantById']>>>;
  kind: 'variant' | 'official';
}

export async function resolveDocumentVoteContext(
  documentService: DocumentService,
  hasOpenVariantsOnBlock: (documentId: string, blockId: string) => Promise<boolean>,
  targetType: DocumentVoteTargetType,
  targetId: string,
): Promise<DocumentVoteContext> {
  if (targetType === 'document-variant') {
    const variant = await documentService.getVariantById(targetId);
    if (!variant || variant.deleted || variant.status !== 'open') {
      throw new BadRequestException('This document variant is not open for voting');
    }
    const doc = await documentService.getById(variant.documentId);
    if (!doc || doc.deleted) {
      throw new NotFoundException('Document not found');
    }
    return { variant, doc, blockId: variant.blockId, kind: 'variant' };
  }

  const parsed = parseOfficialBlockVoteTargetId(targetId);
  if (!parsed) {
    throw new BadRequestException('Invalid official block vote target');
  }

  const doc = await documentService.getById(parsed.documentId);
  if (!doc || doc.deleted) {
    throw new NotFoundException('Document not found');
  }

  const block = documentService.findBlock(doc, parsed.blockId);
  if (!block) {
    throw new NotFoundException('Block not found');
  }

  const hasOpen = await hasOpenVariantsOnBlock(parsed.documentId, parsed.blockId);
  if (!hasOpen) {
    throw new BadRequestException(
      'Official text can only be voted on while block suggestions are open',
    );
  }

  return { doc, blockId: parsed.blockId, kind: 'official' };
}

export async function applyDocumentVoteRatingDelta(
  documentService: DocumentService,
  targetType: DocumentVoteTargetType,
  targetId: string,
  delta: number,
  session?: ClientSession,
): Promise<void> {
  if (targetType === 'document-variant') {
    await documentService.applyRatingDelta(targetId, delta, session);
    return;
  }

  const parsed = parseOfficialBlockVoteTargetId(targetId);
  if (!parsed) {
    throw new BadRequestException('Invalid official block vote target');
  }

  await documentService.applyOfficialBlockRatingDelta(
    parsed.documentId,
    parsed.blockId,
    delta,
    session,
  );
}

export async function getCommunityIdForDocumentVoteTarget(
  documentService: DocumentService,
  targetType: DocumentVoteTargetType,
  targetId: string,
): Promise<string> {
  if (targetType === 'document-variant') {
    const variant = await documentService.getVariantById(targetId);
    if (!variant) {
      throw new NotFoundException('Document variant not found');
    }
    const doc = await documentService.getById(variant.documentId);
    if (!doc) {
      throw new NotFoundException('Document not found');
    }
    return doc.communityId;
  }

  const parsed = parseOfficialBlockVoteTargetId(targetId);
  if (!parsed) {
    throw new BadRequestException('Invalid official block vote target');
  }
  const doc = await documentService.getById(parsed.documentId);
  if (!doc) {
    throw new NotFoundException('Document not found');
  }
  return doc.communityId;
}
