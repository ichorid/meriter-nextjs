'use client';

import { useControlledInput } from './useControlledInput';
import { InputWrapper } from './InputWrapper';

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
            <input
                type={type}
                value={value}
                placeholder={placeholder}
                onChange={(e) => updateValue(e.target.value)}
                className="input input-bordered w-full"
            />
        </InputWrapper>
    );
}

