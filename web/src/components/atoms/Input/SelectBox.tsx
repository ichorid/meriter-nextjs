'use client';

import React, { useState, useEffect } from 'react';
import InformationCircleIcon from '@heroicons/react/24/outline/InformationCircleIcon';

export interface SelectOption {
    name: string;
    value?: string;
}

export interface SelectBoxProps {
    labelTitle?: string;
    labelDescription?: string;
    defaultValue?: string;
    containerStyle?: string;
    placeholder?: string;
    labelStyle?: string;
    options: SelectOption[];
    updateFormValue?: (params: { updateType: string; value: string }) => void;
    updateType?: string;
    className?: string;
    value?: string;
    onChange?: (value: string) => void;
}

export function SelectBox({
    labelTitle,
    labelDescription,
    defaultValue = '',
    containerStyle = '',
    placeholder = '',
    labelStyle = '',
    options,
    updateFormValue,
    updateType,
    className = '',
    value: controlledValue,
    onChange: controlledOnChange,
}: SelectBoxProps) {
    const [internalValue, setInternalValue] = useState(defaultValue || '');
    const isControlled = controlledValue !== undefined;
    const value = isControlled ? controlledValue : internalValue;

    const updateValue = (newValue: string) => {
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
        if (defaultValue && !isControlled) {
            setInternalValue(defaultValue);
        }
    }, [defaultValue, isControlled]);

    return (
        <div className={`inline-block ${containerStyle} ${className}`}>
            {labelTitle && (
                <label className={`label ${labelStyle}`}>
                    <div className="label-text">
                        {labelTitle}
                        {labelDescription && (
                            <div className="tooltip tooltip-right" data-tip={labelDescription}>
                                <InformationCircleIcon className="w-4 h-4" />
                            </div>
                        )}
                    </div>
                </label>
            )}

            <select
                className="select select-bordered w-full"
                value={value}
                onChange={(e) => updateValue(e.target.value)}
            >
                <option disabled value="PLACEHOLDER">
                    {placeholder}
                </option>
                {options.map((o, k) => (
                    <option value={o.value || o.name} key={k}>
                        {o.name}
                    </option>
                ))}
            </select>
        </div>
    );
}

