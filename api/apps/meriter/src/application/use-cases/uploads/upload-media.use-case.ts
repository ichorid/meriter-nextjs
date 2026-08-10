import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { GLOBAL_ROLE_SUPERADMIN } from '../../../domain/common/constants/roles.constants';
import type { PermissionService } from '../../../domain/services/permission.service';
import type {
  MediaUploadPort,
  UploadOptions,
  UploadResult,
} from '../../../domain/ports/media-upload.port';

export class UploadNotConfiguredError extends Error {
  constructor() {
    super('Image upload is not available. S3 storage is not configured.');
    this.name = 'UploadNotConfiguredError';
  }
}

export type UploadImageInput = {
  fileData: string;
  fileName: string;
  mimeType: string;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
};

export type UploadAvatarInput = {
  fileData: string;
  fileName: string;
  mimeType: string;
  userId: string;
  crop?: { x: number; y: number; width: number; height: number };
};

export type UploadCommunityAvatarInput = {
  communityId: string;
  fileData: string;
  fileName: string;
  mimeType: string;
  crop?: { x: number; y: number; width: number; height: number };
};

export type UploadMediaDeps = {
  uploadsService: MediaUploadPort;
  permissionService?: PermissionService;
  user?: { id: string; globalRole?: string };
};

/**
 * BC-12: tRPC upload orchestration — base64 ingress via UploadsService.toMulterFile,
 * then Multer→S3 processing. P-7 retires router-local base64→Multer clones.
 */
export class UploadMediaUseCase {
  constructor(private readonly deps: UploadMediaDeps) {}

  private assertConfigured(): void {
    if (!this.deps.uploadsService.isConfigured()) {
      throw new UploadNotConfiguredError();
    }
  }

  async uploadImage(input: UploadImageInput): Promise<UploadResult> {
    this.assertConfigured();

    const file = this.deps.uploadsService.toMulterFile(
      input.fileData,
      input.fileName,
      input.mimeType,
    );

    const options: UploadOptions = {
      folder: 'posts',
      maxWidth: input.maxWidth,
      maxHeight: input.maxHeight,
      quality: input.quality,
    };

    return this.deps.uploadsService.uploadImage(file, options);
  }

  async uploadAvatar(input: UploadAvatarInput): Promise<UploadResult> {
    this.assertConfigured();

    const file = this.deps.uploadsService.toMulterFile(
      input.fileData,
      input.fileName,
      input.mimeType,
    );

    return this.deps.uploadsService.uploadAvatar(file, input.userId, input.crop);
  }

  async uploadCommunityAvatar(
    input: UploadCommunityAvatarInput,
  ): Promise<UploadResult> {
    this.assertConfigured();

    const user = this.deps.user;
    const permissionService = this.deps.permissionService;
    if (!user || !permissionService) {
      throw new BadRequestException('Upload context is incomplete');
    }

    const userRole = await permissionService.getUserRoleInCommunity(
      user.id,
      input.communityId,
    );

    if (userRole !== 'lead' && user.globalRole !== GLOBAL_ROLE_SUPERADMIN) {
      throw new ForbiddenException(
        'Only community leads can upload community avatars',
      );
    }

    const file = this.deps.uploadsService.toMulterFile(
      input.fileData,
      input.fileName,
      input.mimeType,
    );

    return this.deps.uploadsService.uploadCommunityAvatar(
      file,
      input.communityId,
      input.crop,
    );
  }
}

export function createUploadMediaUseCase(
  deps: UploadMediaDeps,
): UploadMediaUseCase {
  return new UploadMediaUseCase(deps);
}
