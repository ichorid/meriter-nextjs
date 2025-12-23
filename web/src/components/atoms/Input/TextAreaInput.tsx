'use client';

import React from 'react';
import { Textarea } from '@/components/ui/shadcn/textarea';
import { Label } from '@/components/ui/shadcn/label';
import { useControlledInput } from './useControlledInput';
import { cn } from '@/lib/utils';

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
    const { value, updateValue } = useControlledInput({
        value: controlledValue,
        defaultValue,
        onChange: controlledOnChange,
        updateFormValue,
        updateType,
    });

    const textareaId = React.useId();

    return (
        <div className={cn('w-full space-y-1.5', containerStyle, className)}>
            {labelTitle && (
                <Label htmlFor={textareaId} className={labelStyle}>
                    {labelTitle}
                </Label>
            )}
            <Textarea
                id={textareaId}
                value={value}
                placeholder={placeholder}
                onChange={(e) => updateValue(e.target.value)}
                className="w-full"
            />
        </div>
    );
}

