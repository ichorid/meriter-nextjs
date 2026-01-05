'use client';

import React, { useRef, useEffect, useState } from 'react';

interface SliderProps {
    children: React.ReactNode;
    value: number;
    minValue: number;
    maxValue: number;
    onChange: (value: number) => void;
    orientation?: 'horizontal' | 'vertical';
    style?: React.CSSProperties;
}

interface SliderTrackProps {
    children?: React.ReactNode;
    style?: React.CSSProperties;
}

interface SliderFilledTrackProps {
    style?: React.CSSProperties;
}

interface SliderThumbProps {
    style?: React.CSSProperties;
}

export const Slider: React.FC<SliderProps> = ({
    children,
    value,
    minValue,
    maxValue,
    onChange,
    orientation = 'horizontal',
    style,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [trackElement, setTrackElement] = useState<React.ReactElement<SliderTrackProps> | null>(null);
    const [filledTrackElement, setFilledTrackElement] = useState<React.ReactElement<SliderFilledTrackProps> | null>(null);
    const [thumbElement, setThumbElement] = useState<React.ReactElement<SliderThumbProps> | null>(null);

    useEffect(() => {
        React.Children.forEach(children, (child) => {
            if (React.isValidElement(child)) {
                if (child.type === SliderTrack) {
                    const trackChild = child as React.ReactElement<SliderTrackProps>;
                    setTrackElement(trackChild);
                    React.Children.forEach(trackChild.props.children, (trackChildInner) => {
                        if (React.isValidElement(trackChildInner) && trackChildInner.type === SliderFilledTrack) {
                            setFilledTrackElement(trackChildInner as React.ReactElement<SliderFilledTrackProps>);
                        }
                    });
                } else if (child.type === SliderThumb) {
                    setThumbElement(child as React.ReactElement<SliderThumbProps>);
                }
            }
        });
    }, [children]);

    const percentage = maxValue !== minValue ? ((value - minValue) / (maxValue - minValue)) * 100 : 0;

    const inputStyle: React.CSSProperties & { WebkitAppearance?: string } = {
        position: 'absolute',
        width: '100%',
        height: '100%',
        opacity: 0,
        zIndex: 2,
        cursor: 'pointer',
        margin: 0,
        ...(orientation === 'vertical' && {
            writingMode: 'vertical-rl' as React.CSSProperties['writingMode'],
            WebkitAppearance: 'slider-vertical',
        }),
    };

    return (
        <div
            ref={containerRef}
            style={{
                position: 'relative',
                width: '100%',
                ...style,
            }}
        >
            <input
                ref={inputRef}
                type="range"
                min={minValue}
                max={maxValue}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                style={inputStyle}
            />
            {trackElement && (
                <div
                    style={{
                        position: 'absolute',
                        width: '100%',
                        height: '100%',
                        ...trackElement.props.style,
                    }}
                >
                    {filledTrackElement && (
                        <div
                            style={{
                                position: 'absolute',
                                [orientation === 'vertical' ? 'bottom' : 'left']: 0,
                                [orientation === 'vertical' ? 'width' : 'height']: '100%',
                                [orientation === 'vertical' ? 'height' : 'width']: `${percentage}%`,
                                ...filledTrackElement.props.style,
                            }}
                        />
                    )}
                </div>
            )}
            {thumbElement && (
                <div
                    style={{
                        position: 'absolute',
                        [orientation === 'vertical' ? 'bottom' : 'left']: `${percentage}%`,
                        transform:
                            orientation === 'vertical'
                                ? 'translateY(50%)'
                                : 'translateX(-50%)',
                        zIndex: 3,
                        pointerEvents: 'none',
                        ...thumbElement.props.style,
                    }}
                />
            )}
        </div>
    );
};

export const SliderTrack: React.FC<SliderTrackProps> = ({ children, style }) => {
    return <div style={style}>{children}</div>;
};

export const SliderFilledTrack: React.FC<SliderFilledTrackProps> = ({ style }) => {
    return <div style={style} />;
};

export const SliderThumb: React.FC<SliderThumbProps> = ({ style }) => {
    return <div style={style} />;
};
