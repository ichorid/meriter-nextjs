export const MEDIA_UPLOAD_PORT = Symbol('MEDIA_UPLOAD_PORT');

export type ImageVersion = {
  url: string;
  key: string;
  size: number;
  width?: number;
  height?: number;
};

export type UploadResult = {
  url: string;
  key: string;
  size: number;
  mimeType: string;
  width?: number;
  height?: number;
  thumbnail?: ImageVersion;
  medium?: ImageVersion;
  original?: ImageVersion;
};

export type UploadOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  folder?: string;
  generateVersions?: boolean;
  thumbnailSize?: number;
  mediumSize?: number;
  crop?: { x: number; y: number; width: number; height: number };
  forceSquare?: boolean;
  outputSize?: number;
};

export type MulterLikeFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

export type MediaUploadPort = {
  isConfigured(): boolean;
  toMulterFile(fileData: string, fileName: string, mimeType: string): MulterLikeFile;
  uploadImage(file: MulterLikeFile, options: UploadOptions): Promise<UploadResult>;
  uploadAvatar(
    file: MulterLikeFile,
    userId: string,
    crop?: { x: number; y: number; width: number; height: number },
  ): Promise<UploadResult>;
  uploadCommunityAvatar(
    file: MulterLikeFile,
    communityId: string,
    crop?: { x: number; y: number; width: number; height: number },
  ): Promise<UploadResult>;
};
