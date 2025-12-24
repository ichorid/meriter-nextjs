import { _useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';

export interface PollAmountValidationResult {
    isValid: boolean;
    error: string | null;
    numValue: number | null;
}

export interface UsePollAmountValidationOptions {
    balance: number;
}

export function usePollAmountValidation({ balance }: UsePollAmountValidationOptions) {
    const t = useTranslations('polls');

    const validateAmount = useCallback((value: string): PollAmountValidationResult => {
        const trimmed = value.trim();
        
        // Empty string
        if (trimmed === '') {
            return { isValid: false, error: t('amountRequired'), numValue: null };
        }

        // Check if string contains only digits (and optional leading minus, but we don't allow negative)
        // Allow digits only, no decimal points, no letters, no special chars
        if (!/^\d+$/.test(trimmed)) {
            return { isValid: false, error: t('amountMustBeNumber'), numValue: null };
        }

        // Parse explicitly with base 10
        const parsedValue = parseInt(trimmed, 10);
        
        // Check if parse was successful (NaN check)
        if (isNaN(parsedValue)) {
            return { isValid: false, error: t('amountMustBeNumber'), numValue: null };
        }

        // Check if it's actually an integer (no decimals)
        // Since we validated with regex, this should be true, but double-check
        if (parseFloat(trimmed) !== parsedValue) {
            return { isValid: false, error: t('amountMustBeInteger'), numValue: null };
        }

        // Check minimum value
        if (parsedValue < 1) {
            return { isValid: false, error: t('amountMinValue'), numValue: null };
        }

        // Check balance
        if (parsedValue > balance) {
            return { isValid: false, error: t('amountInsufficient', { balance }), numValue: null };
        }

        // Valid
        return { isValid: true, error: null, numValue: parsedValue };
    }, [balance, t]);

    return { validateAmount };
}
