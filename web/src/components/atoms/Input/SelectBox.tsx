'use client';

import React from 'react';
import { useControlledInput } from './useControlledInput';
import { InputWrapper } from './InputWrapper';

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
    const { value, updateValue } = useControlledInput({
        value: controlledValue,
        defaultValue,
        onChange: controlledOnChange,
        updateFormValue,
        updateType,
    });

    return (
        <InputWrapper
            labelTitle={labelTitle}
            labelDescription={labelDescription}
            labelStyle={labelStyle}
            containerStyle={containerStyle}
            className={className}
            containerClassName={`inline-block ${containerStyle} ${className}`}
        >
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
        </InputWrapper>
    );
}

