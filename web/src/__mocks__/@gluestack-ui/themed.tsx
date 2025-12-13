import React from 'react';

// Mock Slider components for testing
export const Slider = React.forwardRef<any, any>(({ children, value, minValue, maxValue, onChange, ...props }, ref) => (
  <div ref={ref} data-testid="slider" {...props}>
    <input
      type="range"
      min={minValue}
      max={maxValue}
      value={value}
      onChange={(e) => onChange?.(Number(e.target.value))}
    />
    {children}
  </div>
));
Slider.displayName = 'Slider';

export const SliderTrack = React.forwardRef<any, any>(({ children, ...props }, ref) => (
  <div ref={ref} data-testid="slider-track" {...props}>
    {children}
  </div>
));
SliderTrack.displayName = 'SliderTrack';

export const SliderFilledTrack = React.forwardRef<any, any>(({ ...props }, ref) => (
  <div ref={ref} data-testid="slider-filled-track" {...props} />
));
SliderFilledTrack.displayName = 'SliderFilledTrack';

export const SliderThumb = React.forwardRef<any, any>(({ ...props }, ref) => (
  <div ref={ref} data-testid="slider-thumb" {...props} />
));
SliderThumb.displayName = 'SliderThumb';

