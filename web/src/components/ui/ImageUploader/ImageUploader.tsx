'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ImagePlus, X, Loader2, AlertCircle } from 'lucide-react';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

// Default text labels (can be overridden via props)
const DEFAULT_LABELS = {
  placeholder: 'Drop image here or click to upload',
  formats: 'JPG, PNG, GIF, WebP',
  maxSize: 'Max 10MB',
  uploading: 'Uploading...',
  invalidType: 'Invalid file type. Please use JPG, PNG, GIF, or WebP',
  tooLarge: 'File is too large. Maximum size is 10MB',
  uploadFailed: 'Upload failed. Please try again',
};

export interface ImageUploaderLabels {
  placeholder?: string;
  formats?: string;
  maxSize?: string;
  uploading?: string;
  invalidType?: string;
  tooLarge?: string;
  uploadFailed?: string;
}

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
  thumbnail?: ImageVersion;
  medium?: ImageVersion;
  original?: ImageVersion;
}

export interface ImageUploaderProps {
  /** Current image URL (for edit mode) */
  value?: string;
  /** Callback when image is uploaded - receives URL string */
  onUpload: (url: string) => void;
  /** Optional callback with full upload result including all versions */
  onUploadComplete?: (result: UploadResult) => void;
  /** Callback when image is removed */
  onRemove?: () => void;
  /** Upload endpoint */
  uploadEndpoint?: string;
  /** Aspect ratio for preview (e.g., 16/9, 1, 4/3) */
  aspectRatio?: number;
  /** Maximum dimensions */
  maxWidth?: number;
  maxHeight?: number;
  /** Placeholder text */
  placeholder?: string;
  /** Whether upload is disabled */
  disabled?: boolean;
  /** Custom class name */
  className?: string;
  /** Compact mode for inline usage */
  compact?: boolean;
  /** Error message */
  error?: string;
  /** Custom labels for internationalization */
  labels?: ImageUploaderLabels;
}

export function ImageUploader({
  value,
  onUpload,
  onUploadComplete,
  onRemove,
  uploadEndpoint = '/api/v1/uploads/image',
  aspectRatio,
  _maxWidth = 1920,
  maxHeight = 1080,
  placeholder,
  disabled = false,
  className = '',
  compact = false,
  error: externalError,
  labels: customLabels,
}: ImageUploaderProps) {
  // Merge custom labels with defaults
  const labels = { ...DEFAULT_LABELS, ...customLabels };
  
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(value || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update preview when value changes externally
  useEffect(() => {
    setPreview(value || null);
  }, [value]);

  const validateFile = useCallback((file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return labels.invalidType;
    }
    if (file.size > MAX_FILE_SIZE) {
      return labels.tooLarge;
    }
    return null;
  }, [labels.invalidType, labels.tooLarge]);

  const uploadFile = useCallback(async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsUploading(true);

    // Show local preview immediately
    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(uploadEndpoint, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || labels.uploadFailed);
      }

      const result = await response.json();
      
      if (result.success && result.data?.url) {
        const uploadResult = result.data as UploadResult;
        // Use medium version for preview if available, otherwise use main URL
        const previewUrl = uploadResult.medium?.url || uploadResult.url;
        setPreview(previewUrl);
        onUpload(uploadResult.url);
        // Call onUploadComplete with full result if provided
        onUploadComplete?.(uploadResult);
      } else {
        throw new Error(labels.uploadFailed);
      }
    } catch {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : labels.uploadFailed);
      setPreview(null);
    } finally {
      setIsUploading(false);
      URL.revokeObjectURL(localPreview);
    }
  }, [uploadEndpoint, onUpload, validateFile, labels.uploadFailed]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isUploading) {
      setIsDragging(true);
    }
  }, [disabled, isUploading]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled || isUploading) return;

    const file = e.dataTransfer.files[0];
    if (file) {
      uploadFile(file);
    }
  }, [disabled, isUploading, uploadFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFile(file);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  }, [uploadFile]);

  const handleClick = useCallback(() => {
    if (!disabled && !isUploading) {
      fileInputRef.current?.click();
    }
  }, [disabled, isUploading]);

  const handleRemove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setPreview(null);
    setError(null);
    onRemove?.();
  }, [onRemove]);

  const displayError = externalError || error;

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_TYPES.join(',')}
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled}
        />
        
        {preview ? (
          <div className="relative inline-flex items-center gap-2">
            <img
              src={preview}
              alt="Preview"
              className="w-10 h-10 object-cover rounded-lg border border-base-300"
            />
            <button
              type="button"
              onClick={handleRemove}
              disabled={disabled || isUploading}
              className="p-1 rounded-full bg-error text-error-content hover:bg-error/90 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleClick}
            disabled={disabled || isUploading}
            className="p-2 rounded-lg border-2 border-dashed border-base-300 hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <Loader2 size={20} className="animate-spin text-base-content/60" />
            ) : (
              <ImagePlus size={20} className="text-base-content/60" />
            )}
          </button>
        )}

        {displayError && (
          <span className="text-xs text-error">{displayError}</span>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
      />

      <div
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`
          relative overflow-hidden rounded-xl border-2 border-dashed transition-all cursor-pointer bg-base-100
          ${isDragging 
            ? 'border-primary bg-primary/10' 
            : 'border-base-300 hover:border-primary/50 hover:bg-primary/5'
          }
          ${disabled || isUploading ? 'opacity-50 cursor-not-allowed' : ''}
          ${displayError ? 'border-error' : ''}
        `}
        style={{
          aspectRatio: aspectRatio ? String(aspectRatio) : undefined,
          minHeight: aspectRatio ? undefined : '120px',
        }}
      >
        {preview ? (
          <div className="relative w-full h-full min-h-[120px]">
            <img
              src={preview}
              alt="Preview"
              className="w-full h-full object-cover"
              style={{
                maxHeight: maxHeight ? `${maxHeight}px` : undefined,
              }}
            />
            
            {/* Overlay with remove button */}
            <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors group">
              <button
                type="button"
                onClick={handleRemove}
                disabled={disabled || isUploading}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-black/80 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Upload progress overlay */}
            {isUploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 size={32} className="animate-spin text-white" />
                  <span className="text-sm text-white font-medium">{labels.uploading}</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center min-h-[120px]">
            {isUploading ? (
              <>
                <Loader2 size={32} className="animate-spin text-primary mb-2" />
                <span className="text-sm text-base-content/60">{labels.uploading}</span>
              </>
            ) : (
              <>
                <ImagePlus size={32} className="text-base-content/40 mb-2" />
                <p className="text-sm text-base-content/60">
                  {placeholder || labels.placeholder}
                </p>
                <p className="text-xs text-base-content/40 mt-1">
                  {labels.formats} • {labels.maxSize}
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Error message */}
      {displayError && (
        <div className="flex items-center gap-1.5 mt-2 text-error">
          <AlertCircle size={14} />
          <span className="text-sm font-medium">{displayError}</span>
        </div>
      )}
    </div>
  );
}

export default ImageUploader;