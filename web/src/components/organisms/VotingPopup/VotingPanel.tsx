'use client';

import React, { useMemo, useRef, useEffect, useState } from 'react';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { useTranslations } from 'next-intl';
import { classList } from '@/shared/lib/classList';

interface VotingPanelProps {
  onClose: () => void;
  amount: number;
  setAmount: (val: number) => void;
  comment: string;
  setComment: (val: string) => void;
  onSubmit: (directionPlus: boolean) => void;
  maxPlus: number;
  maxMinus: number;
  quotaRemaining: number;
  dailyQuota: number;
  usedToday: number;
  error?: string;
  isViewer?: boolean;
}

export const VotingPanel: React.FC<VotingPanelProps> = ({
  onClose,
  amount,
  setAmount,
  comment,
  setComment,
  onSubmit,
  maxPlus,
  maxMinus,
  quotaRemaining,
  dailyQuota,
  usedToday,
  error,
  isViewer = false,
}) => {
  const t = useTranslations('comments');
  const sliderRef = useRef<HTMLDivElement>(null);
  const [voteDirection, setVoteDirection] = useState<'positive' | 'negative'>('positive');
  const prevDirectionRef = useRef<'positive' | 'negative'>('positive');
  
  // Check if downvote is available
  const canDownvote = maxMinus > 0 && !isViewer;
  
  // Calculate slider range - now only goes from 0 to max (right only)
  const max = voteDirection === 'positive' ? maxPlus : maxMinus;
  const min = 0;

  // Get absolute slider value (0 to max)
  const sliderValue = Math.abs(amount);

  const handleSliderChange = (value: number | number[]) => {
    const val = typeof value === 'number' ? value : (value[0] ?? 0);
    // Convert to signed value based on direction
    const signedValue = voteDirection === 'positive' ? val : -val;
    setAmount(signedValue);
  };

  // When direction changes, always reset slider to zero
  useEffect(() => {
    if (prevDirectionRef.current !== voteDirection) {
      setAmount(0);
      prevDirectionRef.current = voteDirection;
    }
  }, [voteDirection, setAmount]);

  // If downvote becomes unavailable and user is on negative, switch to positive
  useEffect(() => {
    if (!canDownvote && voteDirection === 'negative') {
      setVoteDirection('positive');
      setAmount(0);
    }
  }, [canDownvote, voteDirection, setAmount]);

  const isPositive = voteDirection === 'positive';
  const absAmount = Math.abs(amount);

  // Calculate filled track width
  const filledTrackWidth = useMemo(() => {
    if (sliderValue <= 0 || max <= 0) return 0;
    return Math.min(100, (sliderValue / max) * 100);
  }, [sliderValue, max]);

  // Styling for the slider - using CSS variables for theme support
  const railStyle = { 
    backgroundColor: 'var(--base-300)', 
    height: 6, 
    borderRadius: 8 
  };
  
  const handleStyle = {
    backgroundColor: 'var(--base-content)',
    border: 'none',
    height: 20,
    width: 20,
    marginTop: -7,
    opacity: 1,
    boxShadow: '-2px 2px 8px rgba(0, 0, 0, 0.2)',
    borderRadius: '9999px',
  };

  return (
    <div 
      className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-[336px] bg-base-100 rounded-t-[8px] flex flex-col gap-5 shadow-xl z-50 max-h-[90vh] overflow-y-auto"
      style={{ padding: '16px 16px 20px' }}
    >
      {/* Title */}
      <h2 
        className="text-base-content font-bold leading-[41px] tracking-[0.374px]"
        style={{ 
          width: '304px',
          height: '41px',
          fontSize: '24px',
          fontFamily: 'SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif',
          fontWeight: 700,
        }}
      >
        {t('voteTitle')}
      </h2>

      {/* Description */}
      <p 
        className="text-base-content leading-[120%] flex items-center"
        style={{ 
          width: '304px',
          height: '36px',
          fontSize: '15px',
          fontFamily: 'Roboto, sans-serif',
          fontWeight: 400,
        }}
      >
        {t('sliderHint')}
      </p>

      {/* Vote Direction Toggle */}
      {canDownvote && (
        <div className="flex items-center justify-center gap-3" style={{ width: '304px' }}>
          {/* Vote Up Label */}
          <span 
            className={classList(
              "font-medium",
              voteDirection === 'positive' ? "text-success font-bold" : "text-base-content opacity-60"
            )}
            style={{ 
              fontSize: '15px',
              fontFamily: 'Roboto, sans-serif',
            }}
          >
            {t('voteUp')} 👍
          </span>
          
          {/* Toggle Switch */}
          <label 
            className="flex items-center cursor-pointer"
            onClick={() => {
              setVoteDirection(voteDirection === 'positive' ? 'negative' : 'positive');
            }}
          >
            <div 
              className={classList(
                "relative inline-flex items-center rounded-full transition-colors duration-200",
                voteDirection === 'positive' ? "bg-success" : "bg-error"
              )}
              style={{
                width: '56px',
                height: '32px',
              }}
            >
              <div
                className={classList(
                  "bg-white rounded-full shadow-md transform transition-transform duration-200",
                  voteDirection === 'negative' ? "translate-x-6" : "translate-x-1"
                )}
                style={{
                  width: '24px',
                  height: '24px',
                }}
              />
            </div>
          </label>
          
          {/* Vote Down Label */}
          <span 
            className={classList(
              "font-medium",
              voteDirection === 'negative' ? "text-error font-bold" : "text-base-content opacity-60"
            )}
            style={{ 
              fontSize: '15px',
              fontFamily: 'Roboto, sans-serif',
            }}
          >
            {t('voteDown')} 👎
          </span>
        </div>
      )}

      {/* Vote Amount Display - Fixed Position */}
      <div 
        className={classList(
          "flex items-center justify-center font-bold",
          isPositive ? "text-success" : "text-error"
        )}
        style={{ 
          width: '304px',
          fontSize: '24px',
          fontFamily: 'Roboto, sans-serif',
          fontWeight: 700,
          lineHeight: '120%',
        }}
      >
        {isPositive ? (
          <>
            👍 {t('voteUp')}: +{absAmount}
          </>
        ) : (
          <>
            👎 {t('voteDown')}: -{absAmount}
          </>
        )}
      </div>

      {/* Limit / Quota Indicator */}
      <div className="flex flex-col gap-[5px]" style={{ width: '304px', height: '40px' }}>
        <div 
          className="text-base-content opacity-60"
          style={{ 
            fontSize: '12px',
            fontFamily: 'Roboto, sans-serif',
            fontWeight: 400,
            lineHeight: '120%',
            letterSpacing: '0.374px',
          }}
        >
          {t('dailyLimit')}
        </div>
        <div 
          className="relative flex items-center justify-center overflow-hidden bg-base-200"
          style={{ 
            width: '304px',
            height: '40px',
          }}
        >
          {/* Calculate percentages */}
          {(() => {
            const totalQuota = dailyQuota || (quotaRemaining + usedToday);
            if (totalQuota <= 0) return null;
            
            const usedPercent = (usedToday / totalQuota) * 100;
            // For upvotes, vote amount is part of quota; for downvotes, show it visually but it doesn't use quota
            const votePercent = absAmount > 0 ? (absAmount / totalQuota) * 100 : 0;
            const usedWidth = Math.min(100, usedPercent);
            // For upvotes, vote width is limited by remaining quota; for downvotes, show it after used quota
            const maxVoteWidth = isPositive 
              ? Math.min(100 - usedWidth, (quotaRemaining / totalQuota) * 100)
              : Math.min(100 - usedWidth, votePercent);
            const voteWidth = absAmount > 0 ? Math.min(maxVoteWidth, votePercent) : 0;
            
            return (
              <>
                {/* Already used quota - striped pattern */}
                {usedToday > 0 && (
                  <div 
                    className="absolute left-0 top-0 bottom-0 opacity-40"
                    style={{ 
                      width: `${usedWidth}%`,
                      backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.1) 4px, rgba(0,0,0,0.1) 8px)',
                      backgroundColor: 'var(--base-content)',
                      zIndex: 1,
                    }}
                  />
                )}
                
                {/* Current vote amount - colored by direction */}
                {absAmount > 0 && isPositive && (
                  <div 
                    className="absolute top-0 bottom-0 bg-success"
                    style={{ 
                      left: `${usedWidth}%`,
                      width: `${voteWidth}%`,
                      zIndex: 2,
                    }}
                  />
                )}
                {absAmount > 0 && !isPositive && (
                  <div 
                    className="absolute top-0 bottom-0 bg-error"
                    style={{ 
                      left: `${usedWidth}%`,
                      width: `${voteWidth}%`,
                      zIndex: 2,
                    }}
                  />
                )}
              </>
            );
          })()}
          
          <span 
            className="relative z-10 text-base-content"
            style={{ 
              fontSize: '12px',
              fontFamily: 'Roboto, sans-serif',
              fontWeight: 400,
              lineHeight: '120%',
              letterSpacing: '0.374px',
            }}
          >
            {t('available')} {quotaRemaining}
          </span>
        </div>
      </div>

      {/* Slider Container */}
      <div className="relative" style={{ width: '304px', height: '24px' }}>
        {/* Slider */}
        <div 
          ref={sliderRef}
          className="relative"
          style={{ 
            width: '304px',
            height: '24px',
          }}
        >
          {/* Custom track visualization */}
          <div 
            className="absolute bg-base-300"
            style={{ 
              height: 6,
              top: '9px',
              left: 0,
              right: 0,
              borderRadius: 8,
            }}
          />
          
          {/* Filled track */}
          {sliderValue > 0 && (
            <div 
              className="absolute bg-base-content"
              style={{ 
                height: 6,
                top: '9px',
                left: 0,
                width: `${filledTrackWidth}%`,
                borderRadius: 8,
                zIndex: 1,
              }}
            />
          )}

          <Slider
            min={min}
            max={max}
            value={sliderValue}
            onChange={handleSliderChange}
            railStyle={railStyle}
            handleStyle={handleStyle}
            trackStyle={{ display: 'none' }} // Hide default track, using custom one
          />
        </div>
      </div>

      {/* Comment Input */}
      <div className="flex flex-col gap-1" style={{ width: '304px', height: '98px' }}>
        <label 
          className="text-base-content opacity-60"
          style={{ 
            fontSize: '12px',
            fontFamily: 'Roboto, sans-serif',
            fontWeight: 400,
            lineHeight: '120%',
            letterSpacing: '0.374px',
          }}
        >
          {t('explanationDetails')}
        </label>
        <div 
          className="bg-base-100 border border-base-content rounded-[8px]"
          style={{ 
            width: '304px',
            height: '80px',
            padding: '8px 12px',
            boxSizing: 'border-box',
          }}
        >
          <textarea 
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full h-full resize-none outline-none text-base-content placeholder:text-base-content placeholder:opacity-50"
            style={{ 
              fontSize: '15px',
              fontFamily: 'Roboto, sans-serif',
              fontWeight: 400,
              lineHeight: '120%',
            }}
            placeholder={t('textField')}
          />
        </div>
      </div>

      {/* Submit Button */}
      <button
        onClick={() => onSubmit(isPositive)}
        className={classList(
          "flex justify-center items-center border rounded-[8px] sticky bottom-0",
          isPositive 
            ? "border-success bg-success hover:bg-success/90" 
            : "border-error bg-error hover:bg-error/90",
          absAmount === 0 ? "opacity-50 cursor-not-allowed" : ""
        )}
        style={{ 
          width: '304px',
          height: '40px',
          padding: '11px 15px',
          gap: '10px',
          boxSizing: 'border-box',
        }}
        disabled={absAmount === 0}
      >
        <span 
          className="text-base-100 text-center leading-[120%]"
          style={{ 
            fontSize: '15px',
            fontFamily: 'Roboto, sans-serif',
            fontWeight: 400,
          }}
        >
          {t('submit')}
        </span>
      </button>
    </div>
  );
};

