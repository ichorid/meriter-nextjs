'use client';

import { useControlledInput } from './useControlledInput';
import { InputWrapper } from './InputWrapper';

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

    return (
        <InputWrapper
            labelTitle={labelTitle}
            labelStyle={labelStyle}
            containerStyle={containerStyle}
            className={className}
        >
            <textarea
                value={value}
                className="textarea textarea-bordered w-full"
                placeholder={placeholder}
                onChange={(e) => updateValue(e.target.value)}
            />
        </InputWrapper>
    );
}

