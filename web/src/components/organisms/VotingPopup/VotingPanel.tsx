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
  
  // Calculate slider range
  const min = -maxMinus;
  const max = maxPlus;
  const range = max - min;

  const handleSliderChange = (value: number | number[]) => {
    const val = typeof value === 'number' ? value : value[0];
    setAmount(val);
  };

  const isPositive = amount >= 0;
  const absAmount = Math.abs(amount);

  // Calculate position for value indicator based on slider value
  useEffect(() => {
    if (sliderRef.current && range > 0) {
      const percentage = ((amount - min) / range) * 100;
      setSliderValuePosition(percentage);
    }
  }, [amount, min, range]);

  // Calculate filled track width for positive values
  const filledTrackWidth = useMemo(() => {
    if (amount <= 0 || max <= 0) return 0;
    return Math.min(100, (amount / max) * 100);
  }, [amount, max]);

  // Styling for the slider
  const railStyle = { 
    backgroundColor: '#D5D4D4', 
    height: 6, 
    borderRadius: 8 
  };
  
  const handleStyle = {
    backgroundColor: '#020202',
    border: 'none',
    height: 20,
    width: 20,
    marginTop: -7,
    opacity: 1,
    boxShadow: '-2px 2px 8px rgba(38, 38, 38, 0.2)',
    borderRadius: '9999px',
  };

  return (
    <div 
      className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-[336px] bg-white rounded-t-[8px] flex flex-col gap-5 shadow-xl z-50 h-[523px]"
      style={{ padding: '16px 16px 20px' }}
    >
      {/* Title */}
      <h2 
        className="text-[#020202] font-bold leading-[41px] tracking-[0.374px]"
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
        className="text-[#020202] leading-[120%] flex items-center"
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

      {/* Limit / Quota Indicator */}
      <div className="flex flex-col gap-[5px]" style={{ width: '304px', height: '40px' }}>
        <div 
          className="text-[#757575]"
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
          className="relative flex items-center justify-center overflow-hidden"
          style={{ 
            width: '304px',
            height: '40px',
            backgroundColor: '#E0E0E0',
          }}
        >
          {/* Filled indicator - shows used quota */}
          {amount > 0 && (
            <div 
              className="absolute left-0 top-0 bottom-0 bg-[#020202] opacity-30"
              style={{ 
                width: `${Math.min(100, ((absAmount / Math.max(quotaRemaining + absAmount, 1)) * 100))}%`,
                zIndex: 2,
              }}
            />
          )}
          
          <span 
            className="relative z-10 text-[#020202]"
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
        {/* Value Indicator - positioned above slider */}
        <div 
          className="absolute flex items-center"
          style={{ 
            left: `${sliderValuePosition}%`,
            top: '0px',
            transform: 'translateX(-50%)',
            fontSize: '24px',
            fontFamily: 'Roboto, sans-serif',
            fontWeight: 500,
            lineHeight: '120%',
            color: '#020202',
          }}
        >
          {absAmount}
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
            className="absolute"
            style={{ 
              height: 6,
              top: '9px',
              left: 0,
              right: 0,
              backgroundColor: '#D5D4D4',
              borderRadius: 8,
            }}
          />
          
          {/* Filled track for positive values */}
          {amount > 0 && (
            <div 
              className="absolute"
              style={{ 
                height: 6,
                top: '9px',
                left: 0,
                width: `${filledTrackWidth}%`,
                backgroundColor: '#020202',
                borderRadius: 8,
                zIndex: 1,
              }}
            />
          )}

          <Slider
            min={min}
            max={max}
            value={amount}
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
          className="text-[#020202] leading-[120%] flex items-center"
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
          className="text-[#757575]"
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
          className="bg-white border border-[#020202] rounded-[8px]"
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
            className="w-full h-full resize-none outline-none text-[#020202] placeholder-[#020202]"
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
          "flex justify-center items-center border border-[#020202] rounded-[8px]",
          (amount === 0 || (!isPositive && !comment.trim())) ? "opacity-50 cursor-not-allowed" : ""
        )}
        style={{ 
          width: '304px',
          height: '40px',
          backgroundColor: '#020202',
          padding: '11px 15px',
          gap: '10px',
          boxSizing: 'border-box',
        }}
        disabled={amount === 0 || (!isPositive && !comment.trim())}
      >
        <span 
          className="text-white text-center leading-[120%]"
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

