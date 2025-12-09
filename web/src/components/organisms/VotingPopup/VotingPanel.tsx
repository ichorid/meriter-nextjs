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
  error,
  isViewer = false,
}) => {
  const t = useTranslations('comments');
  const sliderRef = useRef<HTMLDivElement>(null);
  const [sliderValuePosition, setSliderValuePosition] = useState<number>(0);
  const [voteDirection, setVoteDirection] = useState<'positive' | 'negative'>('positive');
  
  // Calculate slider range - now only goes from 0 to max (right only)
  const max = voteDirection === 'positive' ? maxPlus : maxMinus;
  const min = 0;
  const range = max - min;

  // Get absolute slider value (0 to max)
  const sliderValue = Math.abs(amount);

  const handleSliderChange = (value: number | number[]) => {
    const val = typeof value === 'number' ? value : (value[0] ?? 0);
    // Convert to signed value based on direction
    const signedValue = voteDirection === 'positive' ? val : -val;
    setAmount(signedValue);
  };

  // When direction changes, reset slider if needed
  useEffect(() => {
    if (voteDirection === 'positive' && amount < 0) {
      setAmount(0);
    } else if (voteDirection === 'negative' && amount > 0) {
      setAmount(0);
    }
  }, [voteDirection, amount, setAmount]);

  const isPositive = voteDirection === 'positive';
  const absAmount = Math.abs(amount);

  // Calculate position for value indicator based on slider value
  useEffect(() => {
    if (sliderRef.current && range > 0) {
      const percentage = ((sliderValue - min) / range) * 100;
      setSliderValuePosition(percentage);
    }
  }, [sliderValue, min, range]);

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
      className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-[336px] bg-base-100 rounded-t-[8px] flex flex-col gap-5 shadow-xl z-50 h-[523px]"
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
        {t('voteTitle') || 'Voting'}
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
        {t('sliderHint') || 'Move the slider to choose the number of votes you want to give.'}
      </p>

      {/* Vote Direction Radio Buttons */}
      <div className="flex gap-4" style={{ width: '304px' }}>
        <label 
          className={classList(
            "flex items-center gap-2 cursor-pointer",
            voteDirection === 'positive' ? "text-success" : "text-base-content opacity-60"
          )}
        >
          <input
            type="radio"
            name="voteDirection"
            value="positive"
            checked={voteDirection === 'positive'}
            onChange={(e) => setVoteDirection(e.target.value as 'positive' | 'negative')}
            className="radio radio-success"
            style={{ 
              accentColor: voteDirection === 'positive' ? 'var(--success)' : undefined,
            }}
          />
          <span 
            className={classList(
              "font-medium",
              voteDirection === 'positive' ? "text-success font-bold" : ""
            )}
            style={{ 
              fontSize: '15px',
              fontFamily: 'Roboto, sans-serif',
            }}
          >
            {t('voteUp') || 'Vote up'} 👍
          </span>
        </label>
        <label 
          className={classList(
            "flex items-center gap-2 cursor-pointer",
            voteDirection === 'negative' ? "text-error" : "text-base-content opacity-60"
          )}
        >
          <input
            type="radio"
            name="voteDirection"
            value="negative"
            checked={voteDirection === 'negative'}
            onChange={(e) => setVoteDirection(e.target.value as 'positive' | 'negative')}
            className="radio radio-error"
            style={{ 
              accentColor: voteDirection === 'negative' ? 'var(--error)' : undefined,
            }}
          />
          <span 
            className={classList(
              "font-medium",
              voteDirection === 'negative' ? "text-error font-bold" : ""
            )}
            style={{ 
              fontSize: '15px',
              fontFamily: 'Roboto, sans-serif',
            }}
          >
            {t('voteDown') || 'Vote down'} 👎
          </span>
        </label>
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
          {t('dailyLimit') || 'Daily limit'}
        </div>
        <div 
          className="relative flex items-center justify-center overflow-hidden bg-base-200"
          style={{ 
            width: '304px',
            height: '40px',
          }}
        >
          {/* Filled indicator - shows used quota/merits */}
          {absAmount > 0 && (
            <div 
              className="absolute left-0 top-0 bottom-0 bg-base-content opacity-30"
              style={{ 
                width: `${Math.min(100, ((absAmount / Math.max(quotaRemaining + absAmount, 1)) * 100))}%`,
                zIndex: 2,
              }}
            />
          )}
          
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
            {t('available') || 'Available'} {quotaRemaining}
          </span>
        </div>
      </div>

      {/* Slider Container */}
      <div className="relative" style={{ width: '304px', height: '58px' }}>
        {/* Value Indicator - positioned above slider with direction and color */}
        <div 
          className={classList(
            "absolute flex items-center font-bold whitespace-nowrap",
            isPositive ? "text-success" : "text-error"
          )}
          style={{ 
            left: `${sliderValuePosition}%`,
            top: '0px',
            transform: 'translateX(-50%)',
            fontSize: '20px',
            fontFamily: 'Roboto, sans-serif',
            fontWeight: 700,
            lineHeight: '120%',
          }}
        >
          {isPositive ? (
            <>
              👍 {t('voteUp') || 'Vote up'}: +{absAmount}
            </>
          ) : (
            <>
              👎 {t('voteDown') || 'Vote down'}: -{absAmount}
            </>
          )}
        </div>

        {/* Slider */}
        <div 
          ref={sliderRef}
          className="relative"
          style={{ 
            width: '304px',
            height: '24px',
            marginTop: '29px',
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

      {/* Downvote Warning / Explanation */}
      {!isPositive && (
        <div 
          className="text-base-content leading-[120%] flex items-center"
          style={{ 
            width: '304px',
            height: '54px',
            fontSize: '15px',
            fontFamily: 'Roboto, sans-serif',
            fontWeight: 400,
          }}
        >
          {t('downvoteExplanation') || 'You are voting against publication. Please leave a detailed explanation, the reason for your decision.'}
        </div>
      )}

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
          {t('explanationDetails') || 'Explanations, details and descriptions'}
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
            placeholder={t('textField') || 'Text field'}
          />
        </div>
      </div>

      {/* Submit Button */}
      <button
        onClick={() => onSubmit(isPositive)}
        className={classList(
          "flex justify-center items-center border rounded-[8px]",
          isPositive 
            ? "border-success bg-success hover:bg-success/90" 
            : "border-error bg-error hover:bg-error/90",
          (absAmount === 0 || (!isPositive && !comment.trim())) ? "opacity-50 cursor-not-allowed" : ""
        )}
        style={{ 
          width: '304px',
          height: '40px',
          padding: '11px 15px',
          gap: '10px',
          boxSizing: 'border-box',
        }}
        disabled={absAmount === 0 || (!isPositive && !comment.trim())}
      >
        <span 
          className="text-base-100 text-center leading-[120%]"
          style={{ 
            fontSize: '15px',
            fontFamily: 'Roboto, sans-serif',
            fontWeight: 400,
          }}
        >
          {t('submit') || 'Submit'}
        </span>
      </button>
    </div>
  );
};

