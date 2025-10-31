'use client';

import { useState, useEffect } from 'react';

export interface InputTextProps {
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

export function InputText({
    labelTitle,
    labelStyle = '',
    type = 'text',
    containerStyle = '',
    defaultValue = '',
    placeholder = '',
    updateFormValue,
    updateType,
    className = '',
    value: controlledValue,
    onChange: controlledOnChange,
}: InputTextProps) {
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
            <input
                type={type}
                value={value}
                placeholder={placeholder}
                onChange={(e) => updateInputValue(e.target.value)}
                className="input input-bordered w-full"
            />
        </div>
    );
}

