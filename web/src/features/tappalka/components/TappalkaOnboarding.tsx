'use client';

import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import { BottomPortal } from '@/shared/components/bottom-portal';
import { cn } from '@/lib/utils';

interface TappalkaOnboardingProps {
  text: string;
  onDismiss: () => void;
  className?: string;
  /** If true, renders without BottomPortal and backdrop (for use inside Dialog) */
  inline?: boolean;
}

export const TappalkaOnboarding: React.FC<TappalkaOnboardingProps> = ({
  text,
  onDismiss,
  className,
  inline = false,
}) => {
  const content = (
    <div
      className={cn(
        'relative w-full max-w-2xl bg-base-100 rounded-t-3xl shadow-2xl',
        'transform transition-transform duration-300 ease-out translate-y-0',
        inline ? 'rounded-3xl' : '',
        className,
      )}
      onClick={(e) => e.stopPropagation()}
    >
          {/* Drag handle - only show for bottom sheet (not inline) */}
          {!inline && (
            <div className="flex justify-center pt-4 pb-2">
              <div className="w-12 h-1.5 bg-base-content/20 rounded-full" />
            </div>
          )}

          {/* Close button */}
          <button
            onClick={onDismiss}
            className="absolute top-4 right-4 p-2 text-base-content/50 hover:text-base-content rounded-full hover:bg-base-content/5 transition-colors z-10"
            aria-label="Закрыть"
          >
            <X size={20} />
          </button>

          {/* Content */}
          <div className="px-6 pb-6 pt-2">
            {/* Title */}
            <h2 className="text-2xl font-bold text-base-content mb-4 pr-8">
              Как работает Тапалка?
            </h2>

            {/* Text content */}
            <div className="prose prose-sm dark:prose-invert max-w-none text-base-content/80 mb-6">
              {text ? (
                <p className="whitespace-pre-line leading-relaxed">{text}</p>
              ) : (
                <div className="space-y-3">
                  <p>
                    Тапалка — это способ сравнить посты и заработать мериты!
                  </p>
                  <p>
                    <strong>Как это работает:</strong>
                  </p>
                  <ol className="list-decimal list-inside space-y-2 ml-2">
                    <li>Перетащите иконку мерита на пост, который вам больше нравится</li>
                    <li>Победивший пост получит мериты</li>
                    <li>За каждые 10 сравнений вы получите награду</li>
                  </ol>
                  <p>
                    Чем больше вы сравниваете, тем больше меритов зарабатываете!
                  </p>
                </div>
              )}
            </div>

            {/* Action button */}
            <Button
              onClick={onDismiss}
              className="w-full bg-brand-primary hover:bg-brand-primary/90 text-white font-semibold py-3 rounded-xl"
              size="lg"
            >
              За работу!
            </Button>
          </div>
        </div>
  );

  if (inline) {
    // Render inline without portal and backdrop (for use inside Dialog)
    return (
      <div className="flex items-start justify-center min-h-full p-4 pt-8">
        {content}
      </div>
    );
  }

  // Render with portal and backdrop (standalone)
  return (
    <BottomPortal>
      <div className="fixed inset-0 z-50 pointer-events-auto flex items-end justify-center">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={onDismiss}
          aria-hidden="true"
        />
        
        {/* Bottom sheet card */}
        {content}
      </div>
    </BottomPortal>
  );
};

