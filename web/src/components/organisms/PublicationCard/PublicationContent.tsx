import React from 'react';
import Image from 'next/image';

export interface PublicationContentProps {
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  type: 'text' | 'image' | 'video';
}

export const PublicationCardContent: React.FC<PublicationContentProps> = ({
  content,
  imageUrl,
  videoUrl,
  type,
}) => {
  return (
    <div className="mb-3">
      <p className="text-base whitespace-pre-wrap break-words">{content}</p>
      
      {type === 'image' && imageUrl && (
        <div className="mt-3 rounded-lg overflow-hidden">
          <Image
            src={imageUrl}
            alt="Publication image"
            width={800}
            height={600}
            className="w-full h-auto object-cover"
          />
        </div>
      )}
      
      {type === 'video' && videoUrl && (
        <div className="mt-3 rounded-lg overflow-hidden">
          <video 
            src={videoUrl} 
            controls 
            className="w-full h-auto max-h-96 object-contain"
          >
            Your browser does not support the video tag.
          </video>
        </div>
      )}
    </div>
  );
};
