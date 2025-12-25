'use client';

import React, { useState, useRef, useCallback } from 'react';
import { ImagePlus, X, Loader2 } from 'lucide-react';
import { ImageViewer } from '../ImageViewer/ImageViewer';
import { ImageUploader, UploadResult } from '../ImageUploader/ImageUploader';
import { useUploadImage } from '@/hooks/api/useUploads';
import { fileToBase64 } from '@/lib/utils/file-utils';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const MAX_IMAGES = 10; // Maximum number of images

export interface ImageGalleryProps {
  /** Array of image URLs */
  images?: string[];
  /** Callback when images change */
  onImagesChange: (images: string[]) => void;
  /** Upload endpoint (deprecated - now uses tRPC) */
  uploadEndpoint?: string;
  /** Whether upload is disabled */
  disabled?: boolean;
  /** Custom class name */
  className?: string;
}

export function ImageGallery({
  images = [],
  onImagesChange,
  uploadEndpoint, // Deprecated - kept for backward compatibility but not used
  disabled = false,
  className = '',
}: ImageGalleryProps) {
  const uploadMutation = useUploadImage();
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback((url: string) => {
    if (images.length >= MAX_IMAGES) return;
    onImagesChange([...images, url]);
  }, [images, onImagesChange]);

  const handleRemove = useCallback((index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(newImages);
    if (viewingIndex !== null) {
      if (viewingIndex >= newImages.length) {
        setViewingIndex(newImages.length > 0 ? newImages.length - 1 : null);
      } else if (viewingIndex > index) {
        setViewingIndex(viewingIndex - 1);
      }
    }
  }, [images, onImagesChange, viewingIndex]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remainingSlots = MAX_IMAGES - images.length;
    const filesToUpload = files.slice(0, remainingSlots).filter((file) => {
      return ALLOWED_TYPES.includes(file.type) && file.size <= MAX_FILE_SIZE;
    });

    if (filesToUpload.length === 0) return;

    setIsUploading(true);

    try {
      // Upload all files in parallel using tRPC
      const uploadPromises = filesToUpload.map(async (file) => {
        const base64 = await fileToBase64(file);
        const result = await uploadMutation.mutateAsync({
          fileData: base64,
          fileName: file.name,
          mimeType: file.type,
          maxWidth: 1920,
          maxHeight: 1080,
          quality: 85,
        });
        return result.url;
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      
      // Add all uploaded images at once
      onImagesChange([...images, ...uploadedUrls]);
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  }, [images, uploadMutation, onImagesChange]);

  const handleClick = useCallback(() => {
    if (!disabled && !isUploading && images.length < MAX_IMAGES) {
      fileInputRef.current?.click();
    }
  }, [disabled, isUploading, images.length]);

  const handleImageClick = useCallback((index: number) => {
    setViewingIndex(index);
  }, []);

  const handleViewerClose = useCallback(() => {
    setViewingIndex(null);
  }, []);

  const handleViewerNext = useCallback(() => {
    if (viewingIndex !== null && viewingIndex < images.length - 1) {
      setViewingIndex(viewingIndex + 1);
    } else if (viewingIndex !== null && viewingIndex === images.length - 1) {
      setViewingIndex(0); // Loop to first
    }
  }, [viewingIndex, images.length]);

  const handleViewerPrev = useCallback(() => {
    if (viewingIndex !== null && viewingIndex > 0) {
      setViewingIndex(viewingIndex - 1);
    } else if (viewingIndex !== null && viewingIndex === 0) {
      setViewingIndex(images.length - 1); // Loop to last
    }
  }, [viewingIndex, images.length]);

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        multiple
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isUploading || images.length >= MAX_IMAGES}
      />

      {/* Image Grid */}
      <div className="flex flex-wrap gap-2">
        {/* Existing Images */}
        {images.map((url, index) => (
          <div
            key={index}
            className="relative group"
          >
            <img
              src={url}
              alt={`Image ${index + 1}`}
              onClick={() => handleImageClick(index)}
              className="w-20 h-20 object-cover rounded-lg border border-base-300 cursor-pointer hover:opacity-80 transition-opacity"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRemove(index);
              }}
              disabled={disabled}
              className="absolute -top-1 -right-1 p-0.5 rounded-full bg-error text-error-content shadow-lg hover:bg-error/90 transition-all disabled:opacity-50 flex items-center justify-center"
              style={{ minWidth: '20px', minHeight: '20px' }}
              title="Remove image"
            >
              <X size={12} />
            </button>
          </div>
        ))}

        {/* Add Image Button */}
        {images.length < MAX_IMAGES && (
          <button
            type="button"
            onClick={handleClick}
            disabled={disabled || isUploading}
            className="w-20 h-20 flex items-center justify-center rounded-lg border-2 border-dashed border-base-300 hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <Loader2 size={20} className="animate-spin text-base-content/60" />
            ) : (
              <ImagePlus size={20} className="text-base-content/60" />
            )}
          </button>
        )}
      </div>

      {/* Image Viewer */}
      {viewingIndex !== null && images[viewingIndex] && (
        <ImageViewer
          src={images[viewingIndex]}
          alt={`Image ${viewingIndex + 1} of ${images.length}`}
          isOpen={true}
          onClose={handleViewerClose}
        />
      )}
    </div>
  );
}

export default ImageGallery;

