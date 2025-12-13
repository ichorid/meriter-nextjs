import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
  Logger,
  Req,
  Param,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserGuard } from '../../user.guard';
import { UploadsService, UploadResult } from './uploads.service';

interface CropData {
  x: number;
  y: number;
  width: number;
  height: number;
}

@Controller('api/v1/uploads')
@UseGuards(UserGuard)
export class UploadsController {
  private readonly logger = new Logger(UploadsController.name);

  constructor(private readonly uploadsService: UploadsService) {}

  /**
   * Upload a general image (for posts, comments)
   * POST /api/v1/uploads/image
   */
  @Post('image')
  @UseInterceptors(FileInterceptor('file', {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
  }))
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ): Promise<{ success: true; data: UploadResult }> {
    if (!this.uploadsService.isConfigured()) {
      throw new BadRequestException('Image upload is not available. S3 storage is not configured.');
    }

    this.logger.log(`User ${req.user?.id} uploading image: ${file?.originalname}`);

    const result = await this.uploadsService.uploadImage(file, {
      folder: 'posts',
      maxWidth: 1920,
      maxHeight: 1080,
      quality: 85,
    });

    return { success: true, data: result };
  }

  /**
   * Upload user avatar with optional crop
   * POST /api/v1/uploads/avatar
   */
  @Post('avatar')
  @UseInterceptors(FileInterceptor('file', {
    limits: {
      fileSize: 10 * 1024 * 1024,
    },
  }))
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @Body('crop') cropJson: string,
    @Req() req: any,
  ): Promise<{ success: true; data: UploadResult }> {
    if (!this.uploadsService.isConfigured()) {
      throw new BadRequestException('Image upload is not available. S3 storage is not configured.');
    }

    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }

    let crop: CropData | undefined;
    if (cropJson) {
      try {
        crop = JSON.parse(cropJson);
      } catch {
        throw new BadRequestException('Invalid crop data format');
      }
    }

    this.logger.log(`User ${userId} uploading avatar`);

    const result = await this.uploadsService.uploadAvatar(file, userId, crop);

    return { success: true, data: result };
  }

  /**
   * Upload community avatar (lead only)
   * POST /api/v1/uploads/community/:communityId/avatar
   */
  @Post('community/:communityId/avatar')
  @UseInterceptors(FileInterceptor('file', {
    limits: {
      fileSize: 10 * 1024 * 1024,
    },
  }))
  async uploadCommunityAvatar(
    @UploadedFile() file: Express.Multer.File,
    @Param('communityId') communityId: string,
    @Body('crop') cropJson: string,
    @Req() req: any,
  ): Promise<{ success: true; data: UploadResult }> {
    if (!this.uploadsService.isConfigured()) {
      throw new BadRequestException('Image upload is not available. S3 storage is not configured.');
    }

    // TODO: Add permission check - only community lead can upload

    let crop: CropData | undefined;
    if (cropJson) {
      try {
        crop = JSON.parse(cropJson);
      } catch {
        throw new BadRequestException('Invalid crop data format');
      }
    }

    this.logger.log(`Uploading avatar for community ${communityId}`);

    const result = await this.uploadsService.uploadCommunityAvatar(file, communityId, crop);

    return { success: true, data: result };
  }
}

