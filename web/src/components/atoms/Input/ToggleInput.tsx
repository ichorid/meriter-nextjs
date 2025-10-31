'use client';

import { useState, useEffect } from 'react';

export interface ToggleInputProps {
    labelTitle?: string;
    labelStyle?: string;
    containerStyle?: string;
    defaultValue?: boolean;
    updateFormValue?: (params: { updateType: string; value: boolean }) => void;
    updateType?: string;
    className?: string;
    value?: boolean;
    onChange?: (value: boolean) => void;
}

export function ToggleInput({
    labelTitle,
    labelStyle = '',
    containerStyle = '',
    defaultValue = false,
    updateFormValue,
    updateType,
    className = '',
    value: controlledValue,
    onChange: controlledOnChange,
}: ToggleInputProps) {
    const [internalValue, setInternalValue] = useState(defaultValue);
    const isControlled = controlledValue !== undefined;
    const value = isControlled ? controlledValue : internalValue;

    const updateToggleValue = () => {
        const newValue = !value;
        if (!isControlled) {
            setInternalValue(newValue);
        }
        if (controlledOnChange) {
            controlledOnChange(newValue);
        }
        if (updateFormValue && updateType) {
            updateFormValue({ updateType, value: newValue });
        }
    };

    useEffect(() => {
        if (defaultValue !== undefined && !isControlled) {
            setInternalValue(defaultValue);
        }
    }, [defaultValue, isControlled]);

    return (
        <div className={`form-control w-full ${containerStyle} ${className}`}>
            {labelTitle && (
                <label className="label cursor-pointer">
                    <span className={`label-text text-base-content ${labelStyle}`}>{labelTitle}</span>
                    <input
                        type="checkbox"
                        className="toggle"
                        checked={value}
                        onChange={updateToggleValue}
                    />
                </label>
            )}
        </div>
    );
}

