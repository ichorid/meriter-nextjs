import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import * as sharp from 'sharp';

export interface FileUploadResult {
  url: string;
  key: string;
  size: number;
  mimeType: string;
}

@Injectable()
export class TelegramFileHandlerService {
  private readonly logger = new Logger(TelegramFileHandlerService.name);
  private s3Client: S3Client;
  private readonly bucketName: string;

  constructor() {
    const s3Endpoint = process.env.S3_ENDPOINT;
    const bucketName = process.env.S3_BUCKET_NAME;

    if (s3Endpoint && !bucketName) {
      throw new Error('S3_BUCKET_NAME must be configured when S3_ENDPOINT is set.');
    }

    if (!bucketName) {
      throw new Error('S3_BUCKET_NAME must be configured for Telegram file handling.');
    }

    this.s3Client = new S3Client({
      region: process.env.S3_REGION || 'us-east-1',
      endpoint: process.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
      },
    });
    this.bucketName = bucketName;
  }

  async downloadAndProcessImage(fileUrl: string, fileName: string): Promise<FileUploadResult> {
    this.logger.log(`Downloading and processing image: ${fileName}`);

    try {
      // Download file
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      // Process image with Sharp
      const processedBuffer = await sharp(buffer)
        .resize(800, 600, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();

      // Upload to S3
      const key = `telegram-images/${Date.now()}-${fileName}`;
      const uploadResult = await this.uploadToS3(processedBuffer, key, 'image/jpeg');

      this.logger.log(`Image processed and uploaded: ${uploadResult.url}`);
      return uploadResult;
    } catch (error) {
      this.logger.error(`Failed to process image ${fileName}:`, error);
      throw error;
    }
  }

  async downloadAndProcessVideo(fileUrl: string, fileName: string): Promise<FileUploadResult> {
    this.logger.log(`Downloading and processing video: ${fileName}`);

    try {
      // Download file
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      // Upload to S3 (no processing for videos)
      const key = `telegram-videos/${Date.now()}-${fileName}`;
      const uploadResult = await this.uploadToS3(buffer, key, 'video/mp4');

      this.logger.log(`Video uploaded: ${uploadResult.url}`);
      return uploadResult;
    } catch (error) {
      this.logger.error(`Failed to process video ${fileName}:`, error);
      throw error;
    }
  }

  private async uploadToS3(buffer: Buffer, key: string, contentType: string): Promise<FileUploadResult> {
    const upload = new Upload({
      client: this.s3Client,
      params: {
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ACL: 'public-read',
      },
    });

    const result = await upload.done();
    const url = `https://${this.bucketName}.s3.amazonaws.com/${key}`;

    return {
      url,
      key,
      size: buffer.length,
      mimeType: contentType,
    };
  }

  async deleteFile(key: string): Promise<void> {
    this.logger.log(`Deleting file: ${key}`);

    try {
      await this.s3Client.send(new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: '', // Empty body to delete
      }));

      this.logger.log(`File deleted: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete file ${key}:`, error);
      throw error;
    }
  }

  generateFileName(originalName: string, prefix: string = ''): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    const extension = originalName.split('.').pop() || 'bin';
    
    return `${prefix}${timestamp}-${random}.${extension}`;
  }
}
