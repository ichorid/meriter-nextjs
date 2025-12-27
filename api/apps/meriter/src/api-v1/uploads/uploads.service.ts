import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { AppConfig } from '../../config/configuration';
import * as sharp from 'sharp';
import { uid } from 'uid';

export interface ImageVersion {
  url: string;
  key: string;
  size: number;
  width?: number;
  height?: number;
}

export interface UploadResult {
  url: string;
  key: string;
  size: number;
  mimeType: string;
  width?: number;
  height?: number;
  // Multiple versions for responsive images
  thumbnail?: ImageVersion;
  medium?: ImageVersion;
  original?: ImageVersion;
}

export interface UploadOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  folder?: string;
  // Generate multiple versions for responsive images
  generateVersions?: boolean;
  thumbnailSize?: number;
  mediumSize?: number;
  // For avatar cropping
  crop?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  // Force square output (for avatars)
  forceSquare?: boolean;
  outputSize?: number;
}

// Image size presets
const IMAGE_SIZES = {
  thumbnail: { width: 150, height: 150, quality: 70 },
  medium: { width: 800, height: 600, quality: 80 },
  large: { width: 1920, height: 1080, quality: 85 },
};

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private s3Client: S3Client | null = null;
  private readonly bucketName?: string;
  private readonly s3Endpoint?: string;

  constructor(private configService: ConfigService<AppConfig>) {
    const s3Endpoint = this.configService.get('storage.s3.endpoint');
    const bucketName = this.configService.get('storage.s3.bucketName');
    const s3AccessKeyId = this.configService.get('storage.s3.accessKeyId');
    const s3SecretAccessKey = this.configService.get('storage.s3.secretAccessKey');

    const isS3Configured = !!(s3Endpoint && bucketName && s3AccessKeyId && s3SecretAccessKey);

    if (isS3Configured) {
      this.logger.log('✅ S3 storage is configured for uploads');
      this.s3Client = new S3Client({
        region: this.configService.get('storage.s3.region', 'us-east-1'),
        endpoint: s3Endpoint,
        credentials: {
          accessKeyId: s3AccessKeyId,
          secretAccessKey: s3SecretAccessKey,
        },
        forcePathStyle: true, // Required for non-AWS S3 providers
      });
      this.bucketName = bucketName;
      this.s3Endpoint = s3Endpoint;
    } else {
      this.logger.warn('⚠️  S3 storage is not configured - upload features will be disabled');
    }
  }

  isConfigured(): boolean {
    return this.s3Client !== null && this.bucketName !== undefined;
  }

  validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type: ${file.mimetype}. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum allowed: 10MB`
      );
    }
  }

  /**
   * Process image to specific size
   */
  private async processImageToSize(
    buffer: Buffer,
    width: number,
    height: number,
    quality: number,
    outputFormat: 'jpeg' | 'png',
    fit: 'inside' | 'cover' = 'inside',
    skipRotation: boolean = false, // Skip rotation if already rotated
  ): Promise<{ buffer: Buffer; metadata: sharp.Metadata }> {
    let sharpInstance = sharp(buffer);
    
    // Only rotate if not already rotated (EXIF orientation handling)
    if (!skipRotation) {
      sharpInstance = sharpInstance.rotate(); // Auto-rotate based on EXIF orientation and strip EXIF data
    }
    
    sharpInstance = sharpInstance.resize(width, height, {
      fit,
      withoutEnlargement: true,
      position: 'center',
    });

    if (outputFormat === 'jpeg') {
      sharpInstance = sharpInstance.jpeg({ quality, mozjpeg: true });
    } else {
      sharpInstance = sharpInstance.png({ quality, compressionLevel: 9 });
    }

    const processedBuffer = await sharpInstance.toBuffer();
    const metadata = await sharp(processedBuffer).metadata();

    return { buffer: processedBuffer, metadata };
  }

  /**
   * Upload a single image version to S3
   */
  private async uploadToS3(
    buffer: Buffer,
    key: string,
    contentType: string,
  ): Promise<void> {
    await this.s3Client!.send(new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ACL: 'public-read',
      CacheControl: 'public, max-age=31536000, immutable',
    }));
  }

  async uploadImage(
    file: Express.Multer.File,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    if (!this.s3Client || !this.bucketName) {
      throw new BadRequestException('S3 storage is not configured');
    }

    this.validateFile(file);

    const {
      maxWidth = IMAGE_SIZES.large.width,
      maxHeight = IMAGE_SIZES.large.height,
      quality = IMAGE_SIZES.large.quality,
      folder = 'images',
      generateVersions = true,
      crop,
      forceSquare = false,
      outputSize,
    } = options;

    try {
      let imageBuffer = file.buffer;
      let isRotated = false;
      
      // Rotate image based on EXIF orientation first (before any processing)
      // This ensures correct orientation for cropping and resizing
      imageBuffer = await sharp(imageBuffer)
        .rotate() // Auto-rotate based on EXIF orientation and strip EXIF data
        .toBuffer();
      isRotated = true;
      
      // Apply crop if provided (image is already rotated)
      if (crop) {
        imageBuffer = await sharp(imageBuffer)
          .extract({
            left: Math.round(crop.x),
            top: Math.round(crop.y),
            width: Math.round(crop.width),
            height: Math.round(crop.height),
          })
          .toBuffer();
      }

      // Determine output format (preserve PNG for transparency)
      const outputFormat = file.mimetype === 'image/png' ? 'png' : 'jpeg';
      const fileExtension = outputFormat === 'jpeg' ? 'jpg' : 'png';
      const contentType = `image/${outputFormat}`;
      
      // Generate unique base filename
      const baseFileName = uid(16);

      // For avatars (forceSquare), just upload single optimized version
      if (forceSquare && outputSize) {
        const { buffer, metadata } = await this.processImageToSize(
          imageBuffer,
          outputSize,
          outputSize,
          quality,
          outputFormat,
          'cover',
          isRotated, // Skip rotation since already rotated
        );

        const key = `${folder}/${baseFileName}.${fileExtension}`;
        await this.uploadToS3(buffer, key, contentType);
        const url = this.getPublicUrl(key);

        this.logger.log(`Avatar uploaded: ${url} (${buffer.length} bytes)`);

        return {
          url,
          key,
          size: buffer.length,
          mimeType: contentType,
          width: metadata.width,
          height: metadata.height,
        };
      }

      // Generate multiple versions for regular images
      const versions: {
        thumbnail?: ImageVersion;
        medium?: ImageVersion;
        original?: ImageVersion;
      } = {};

      // Process and upload main (large) version
      const { buffer: largeBuffer, metadata: largeMetadata } = await this.processImageToSize(
        imageBuffer,
        maxWidth,
        maxHeight,
        quality,
        outputFormat,
        'inside',
        isRotated, // Skip rotation since already rotated
      );
      const largeKey = `${folder}/${baseFileName}.${fileExtension}`;
      await this.uploadToS3(largeBuffer, largeKey, contentType);

      if (generateVersions) {
        // Generate thumbnail (150x150, cover fit for consistent aspect)
        const { buffer: thumbBuffer, metadata: thumbMeta } = await this.processImageToSize(
          imageBuffer,
          IMAGE_SIZES.thumbnail.width,
          IMAGE_SIZES.thumbnail.height,
          IMAGE_SIZES.thumbnail.quality,
          outputFormat,
          'cover',
          isRotated, // Skip rotation since already rotated
        );
        const thumbKey = `${folder}/${baseFileName}_thumb.${fileExtension}`;
        await this.uploadToS3(thumbBuffer, thumbKey, contentType);
        
        versions.thumbnail = {
          url: this.getPublicUrl(thumbKey),
          key: thumbKey,
          size: thumbBuffer.length,
          width: thumbMeta.width,
          height: thumbMeta.height,
        };

        // Generate medium version (800x600)
        const { buffer: mediumBuffer, metadata: mediumMeta } = await this.processImageToSize(
          imageBuffer,
          IMAGE_SIZES.medium.width,
          IMAGE_SIZES.medium.height,
          IMAGE_SIZES.medium.quality,
          outputFormat,
          'inside',
          isRotated, // Skip rotation since already rotated
        );
        const mediumKey = `${folder}/${baseFileName}_medium.${fileExtension}`;
        await this.uploadToS3(mediumBuffer, mediumKey, contentType);
        
        versions.medium = {
          url: this.getPublicUrl(mediumKey),
          key: mediumKey,
          size: mediumBuffer.length,
          width: mediumMeta.width,
          height: mediumMeta.height,
        };

        // Store original info
        versions.original = {
          url: this.getPublicUrl(largeKey),
          key: largeKey,
          size: largeBuffer.length,
          width: largeMetadata.width,
          height: largeMetadata.height,
        };
      }

      const url = this.getPublicUrl(largeKey);

      this.logger.log(
        `Image uploaded with ${generateVersions ? '3 versions' : '1 version'}: ${url} ` +
        `(main: ${largeBuffer.length} bytes${versions.thumbnail ? `, thumb: ${versions.thumbnail.size} bytes` : ''})`
      );

      return {
        url,
        key: largeKey,
        size: largeBuffer.length,
        mimeType: contentType,
        width: largeMetadata.width,
        height: largeMetadata.height,
        ...versions,
      };
    } catch (error) {
      this.logger.error('Failed to upload image:', error);
      throw new BadRequestException('Failed to process and upload image');
    }
  }

  async uploadAvatar(
    file: Express.Multer.File,
    userId: string,
    crop?: { x: number; y: number; width: number; height: number }
  ): Promise<UploadResult> {
    return this.uploadImage(file, {
      folder: `avatars/${userId}`,
      forceSquare: true,
      outputSize: 256, // Standard avatar size
      quality: 90,
      crop,
    });
  }

  async uploadCommunityAvatar(
    file: Express.Multer.File,
    communityId: string,
    crop?: { x: number; y: number; width: number; height: number }
  ): Promise<UploadResult> {
    return this.uploadImage(file, {
      folder: `communities/${communityId}`,
      forceSquare: true,
      outputSize: 256,
      quality: 90,
      crop,
    });
  }

  async deleteImage(key: string): Promise<void> {
    if (!this.s3Client || !this.bucketName) {
      this.logger.warn('Cannot delete image: S3 not configured');
      return;
    }

    try {
      await this.s3Client.send(new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      }));
      this.logger.log(`Image deleted: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete image ${key}:`, error);
    }
  }

  private getPublicUrl(key: string): string {
    // For S3-compatible providers, construct URL from endpoint
    if (this.s3Endpoint && this.bucketName) {
      // Remove trailing slash from endpoint if present
      const endpoint = this.s3Endpoint.replace(/\/$/, '');
      // Check if endpoint already contains bucket (some providers use path-style)
      if (endpoint.includes(this.bucketName)) {
        return `${endpoint}/${key}`;
      }
      // Use virtual-hosted style URL for most providers
      return `${endpoint}/${this.bucketName}/${key}`;
    }
    // Fallback to AWS-style URL
    return `https://${this.bucketName}.s3.amazonaws.com/${key}`;
  }
}

