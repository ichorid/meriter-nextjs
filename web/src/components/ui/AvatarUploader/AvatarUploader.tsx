'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Camera, _X, Loader2, RotateCcw, ZoomIn, ZoomOut, Check } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';
import { cn } from '@/lib/utils';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

// Default labels
const DEFAULT_LABELS = {
  upload: 'Change avatar',
  cropTitle: 'Crop avatar',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  reset: 'Reset',
  dragToPosition: 'Drag to position, scroll to zoom',
  cancel: 'Cancel',
  save: 'Save',
  invalidType: 'Invalid file type. Please use JPG, PNG, or WebP',
  tooLarge: 'File is too large. Maximum size is 10MB',
  uploadFailed: 'Upload failed. Please try again',
};

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AvatarUploaderLabels {
  upload?: string;
  cropTitle?: string;
  zoomIn?: string;
  zoomOut?: string;
  reset?: string;
  dragToPosition?: string;
  cancel?: string;
  save?: string;
  invalidType?: string;
  tooLarge?: string;
  uploadFailed?: string;
}

export interface AvatarUploaderProps {
  /** Current avatar URL */
  value?: string;
  /** Callback when avatar is uploaded */
  onUpload: (url: string) => void;
  /** Size of the avatar preview (default: 96) */
  size?: number;
  /** Whether upload is disabled */
  disabled?: boolean;
  /** Custom class name */
  className?: string;
  /** Upload endpoint */
  uploadEndpoint?: string;
  /** Custom labels */
  labels?: AvatarUploaderLabels;
}

export function AvatarUploader({
  value,
  onUpload,
  size = 96,
  disabled = false,
  className = '',
  uploadEndpoint = '/api/v1/uploads/avatar',
  labels: customLabels,
}: AvatarUploaderProps) {
  const labels = { ...DEFAULT_LABELS, ...customLabels };
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Crop state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const validateFile = useCallback((file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return labels.invalidType;
    }
    if (file.size > MAX_FILE_SIZE) {
      return labels.tooLarge;
    }
    return null;
  }, [labels.invalidType, labels.tooLarge]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    setIsModalOpen(true);
    
    // Reset input
    e.target.value = '';
  }, [validateFile]);

  const handleClose = useCallback(() => {
    setIsModalOpen(false);
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    setError(null);
  }, [previewUrl]);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setError(null);

    try {
      // Calculate crop area based on zoom and position
      const img = imageRef.current;
      if (!img) throw new Error('Image not loaded');

      const containerSize = 280; // Match the preview container size
      const scale = Math.min(img.naturalWidth, img.naturalHeight) / containerSize;
      
      const cropSize = (containerSize / zoom) * scale;
      const cropX = ((containerSize / 2 - position.x) / zoom - containerSize / 2 / zoom) * scale + (img.naturalWidth - cropSize) / 2;
      const cropY = ((containerSize / 2 - position.y) / zoom - containerSize / 2 / zoom) * scale + (img.naturalHeight - cropSize) / 2;

      const crop = {
        x: Math.max(0, cropX),
        y: Math.max(0, cropY),
        width: Math.min(cropSize, img.naturalWidth),
        height: Math.min(cropSize, img.naturalHeight),
      };

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('crop', JSON.stringify(crop));

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
        onUpload(result.data.url);
        handleClose();
      } else {
        throw new Error(labels.uploadFailed);
      }
    } catch {
      console.error('Avatar upload error:', err);
      setError(err instanceof Error ? err.message : labels.uploadFailed);
    } finally {
      setIsUploading(false);
    }
  }, [selectedFile, uploadEndpoint, onUpload, zoom, position, labels.uploadFailed, handleClose]);

  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + 0.1, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev - 0.1, 0.5));
  }, []);

  const handleReset = useCallback(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  // Touch/mouse drag handlers
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
    
    const clientX = 'touches' in e ? (e.touches[0]?.clientX ?? 0) : e.clientX;
    const clientY = 'touches' in e ? (e.touches[0]?.clientY ?? 0) : e.clientY;
    
    setDragStart({ x: clientX - position.x, y: clientY - position.y });
  }, [position]);

  const handleDragMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    
    const clientX = 'touches' in e ? (e.touches[0]?.clientX ?? 0) : e.clientX;
    const clientY = 'touches' in e ? (e.touches[0]?.clientY ?? 0) : e.clientY;
    
    const maxOffset = 100 * zoom;
    const newX = Math.max(-maxOffset, Math.min(maxOffset, clientX - dragStart.x));
    const newY = Math.max(-maxOffset, Math.min(maxOffset, clientY - dragStart.y));
    
    setPosition({ x: newX, y: newY });
  }, [isDragging, dragStart, zoom]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(prev => Math.max(0.5, Math.min(3, prev + delta)));
  }, []);

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

      {/* Avatar display with upload button */}
      <div className="relative inline-block">
        <div
          className="rounded-full overflow-hidden bg-base-200 border-2 border-base-300"
          style={{ width: size, height: size }}
        >
          {value ? (
            <img
              src={value}
              alt="Avatar"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-primary/10">
              <Camera size={size / 3} className="text-base-content/40" />
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="absolute -bottom-1 -right-1 p-2 rounded-full bg-primary text-primary-content shadow-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={labels.upload}
        >
          <Camera size={16} />
        </button>
      </div>

      {error && !isModalOpen && (
        <p className="text-sm text-error mt-2">{error}</p>
      )}

      {/* Crop modal */}
      <Dialog open={isModalOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className={cn('max-w-lg rounded-2xl max-h-[90vh] flex flex-col p-0')}>
          <DialogHeader className="p-6 border-b">
            <DialogTitle>{labels.cropTitle}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-4">
          {/* Preview with crop area */}
          <div 
            ref={containerRef}
            className="relative mx-auto overflow-hidden rounded-full bg-black"
            style={{ width: 280, height: 280 }}
            onMouseDown={handleDragStart}
            onMouseMove={handleDragMove}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
            onTouchStart={handleDragStart}
            onTouchMove={handleDragMove}
            onTouchEnd={handleDragEnd}
            onWheel={handleWheel}
          >
            {previewUrl && (
              <img
                ref={imageRef}
                src={previewUrl}
                alt="Preview"
                className="absolute select-none"
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                  transformOrigin: 'center',
                  maxWidth: 'none',
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  cursor: isDragging ? 'grabbing' : 'grab',
                }}
                draggable={false}
              />
            )}
            
            {/* Circular crop overlay */}
            <div 
              className="absolute inset-0 pointer-events-none"
              style={{
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
                borderRadius: '50%',
              }}
            />
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-2 rounded-lg text-base-content hover:bg-base-200 transition-colors"
              title={labels.zoomOut}
            >
              <ZoomOut size={20} />
            </button>
            
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.1"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-32 accent-primary"
            />
            
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-2 rounded-lg text-base-content hover:bg-base-200 transition-colors"
              title={labels.zoomIn}
            >
              <ZoomIn size={20} />
            </button>
            
            <button
              type="button"
              onClick={handleReset}
              className="p-2 rounded-lg text-base-content hover:bg-base-200 transition-colors"
              title={labels.reset}
            >
              <RotateCcw size={20} />
            </button>
          </div>

          <p className="text-sm text-base-content/60 text-center">
            {labels.dragToPosition}
          </p>

          {error && (
            <p className="text-sm text-error text-center">{error}</p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isUploading}
              className="rounded-xl active:scale-[0.98]"
            >
              {labels.cancel}
            </Button>
            <Button
              variant="default"
              onClick={handleUpload}
              disabled={isUploading}
              className="rounded-xl active:scale-[0.98]"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check size={16} />
              )}
              {labels.save}
            </Button>
          </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AvatarUploader;