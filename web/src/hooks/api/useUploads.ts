import { trpc } from '@/lib/trpc/client';
import { fileToBase64 } from '@/lib/utils/file-utils';

/**
 * Hook for uploading images (for posts, comments)
 */
export function useUploadImage() {
  return trpc.uploads.uploadImage.useMutation();
}

/**
 * Hook for uploading user avatar
 */
export function useUploadAvatar() {
  return trpc.uploads.uploadAvatar.useMutation();
}

/**
 * Hook for uploading community avatar (lead only)
 */
export function useUploadCommunityAvatar() {
  return trpc.uploads.uploadCommunityAvatar.useMutation();
}

/**
 * Helper function to upload a file using tRPC
 * Converts File to base64 and calls the mutation
 */
export async function uploadFile(
  file: File,
  mutation: ReturnType<typeof useUploadImage>,
  options?: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
  }
): Promise<string> {
  const base64 = await fileToBase64(file);
  
  const result = await mutation.mutateAsync({
    fileData: base64,
    fileName: file.name,
    mimeType: file.type,
    maxWidth: options?.maxWidth,
    maxHeight: options?.maxHeight,
    quality: options?.quality,
  });
  
  return result.url;
}

/**
 * Helper function to upload avatar with crop
 */
export async function uploadAvatarFile(
  file: File,
  mutation: ReturnType<typeof useUploadAvatar>,
  crop?: { x: number; y: number; width: number; height: number }
): Promise<string> {
  const base64 = await fileToBase64(file);
  
  const result = await mutation.mutateAsync({
    fileData: base64,
    fileName: file.name,
    mimeType: file.type,
    crop,
  });
  
  return result.url;
}

/**
 * Helper function to upload community avatar with crop
 */
export async function uploadCommunityAvatarFile(
  file: File,
  communityId: string,
  mutation: ReturnType<typeof useUploadCommunityAvatar>,
  crop?: { x: number; y: number; width: number; height: number }
): Promise<string> {
  const base64 = await fileToBase64(file);
  
  const result = await mutation.mutateAsync({
    communityId,
    fileData: base64,
    fileName: file.name,
    mimeType: file.type,
    crop,
  });
  
  return result.url;
}











