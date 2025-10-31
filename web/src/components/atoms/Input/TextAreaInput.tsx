'use client';

import { useState, useEffect } from 'react';

export interface TextAreaInputProps {
    labelTitle?: string;
    labelStyle?: string;
    type?: string;
    containerStyle?: string;
    defaultValue?: string;
    placeholder?: string;
    updateFormValue?: (params: { updateType: string; value: string }) => void;
    updateType?: string;
    className?: string;
    value?: string;
    onChange?: (value: string) => void;
}

export function TextAreaInput({
    labelTitle,
    labelStyle = '',
    containerStyle = '',
    defaultValue = '',
    placeholder = '',
    updateFormValue,
    updateType,
    className = '',
    value: controlledValue,
    onChange: controlledOnChange,
}: TextAreaInputProps) {
    const [internalValue, setInternalValue] = useState(defaultValue);
    const isControlled = controlledValue !== undefined;
    const value = isControlled ? controlledValue : internalValue;

    const updateInputValue = (val: string) => {
        if (!isControlled) {
            setInternalValue(val);
        }
        if (controlledOnChange) {
            controlledOnChange(val);
        }
        if (updateFormValue && updateType) {
            updateFormValue({ updateType, value: val });
        }
    };

    useEffect(() => {
        if (defaultValue && !isControlled) {
            setInternalValue(defaultValue);
        }
    }, [defaultValue, isControlled]);

    return (
        <div className={`form-control w-full ${containerStyle} ${className}`}>
            {labelTitle && (
                <label className="label">
                    <span className={`label-text text-base-content ${labelStyle}`}>{labelTitle}</span>
                </label>
            )}
            <textarea
                value={value}
                className="textarea textarea-bordered w-full"
                placeholder={placeholder}
                onChange={(e) => updateInputValue(e.target.value)}
            />
        </div>
    );
}

