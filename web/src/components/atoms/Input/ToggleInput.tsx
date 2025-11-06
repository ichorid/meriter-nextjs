'use client';

import { useControlledInput } from './useControlledInput';
import { InputWrapper } from './InputWrapper';

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
    const { value, updateValue } = useControlledInput({
        value: controlledValue,
        defaultValue,
        onChange: controlledOnChange,
        updateFormValue,
        updateType,
    });

    const updateToggleValue = () => {
        updateValue(!value);
    };

    return (
        <InputWrapper
            labelTitle={labelTitle}
            labelStyle={labelStyle}
            containerStyle={containerStyle}
            className={className}
            renderLabelAsWrapper={true}
        >
            <input
                type="checkbox"
                className="toggle"
                checked={value}
                onChange={updateToggleValue}
            />
        </InputWrapper>
    );
}

