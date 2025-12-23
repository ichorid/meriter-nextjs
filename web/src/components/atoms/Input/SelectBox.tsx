'use client';

import React from 'react';
import { useControlledInput } from './useControlledInput';
import { InputWrapper } from './InputWrapper';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/shadcn/select';
import { cn } from '@/lib/utils';

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
            containerClassName={cn('inline-block', containerStyle, className)}
        >
            <Select value={value || undefined} onValueChange={updateValue}>
                <SelectTrigger className="w-full">
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent>
                    {options.map((o, k) => (
                        <SelectItem key={k} value={o.value || o.name}>
                            {o.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </InputWrapper>
    );
}

