'use client';

import { useState, useEffect, useCallback } from 'react';

export interface ControlledInputOptions<T> {
    value?: T;
    defaultValue: T;
    onChange?: (value: T) => void;
    updateFormValue?: (params: { updateType: string; value: T }) => void;
    updateType?: string;
}

export function useControlledInput<T>({
    value: controlledValue,
    defaultValue,
    onChange: controlledOnChange,
    updateFormValue,
    updateType,
}: ControlledInputOptions<T>) {
    const [internalValue, setInternalValue] = useState<T>(defaultValue);
    const isControlled = controlledValue !== undefined;
    const value = isControlled ? controlledValue : internalValue;

    const updateValue = useCallback((newValue: T) => {
        if (!isControlled) {
            setInternalValue(newValue);
        }
        if (controlledOnChange) {
            controlledOnChange(newValue);
        }
        if (updateFormValue && updateType) {
            updateFormValue({ updateType, value: newValue });
        }
    }, [isControlled, controlledOnChange, updateFormValue, updateType]);

    useEffect(() => {
        if (defaultValue !== undefined && !isControlled) {
            setInternalValue(defaultValue);
        }
    }, [defaultValue, isControlled]);

    return {
        value,
        updateValue,
        isControlled,
    };
}

