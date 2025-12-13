'use client';

import React, { useState, KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import { BrandInput } from '@/components/ui/BrandInput';
import { BrandFormControl } from '@/components/ui/BrandFormControl';
import { X, Hash } from 'lucide-react';

interface HashtagInputProps {
    value: string[];
    onChange: (hashtags: string[]) => void;
    label?: string;
    placeholder?: string;
    helperText?: string;
    maxTags?: number;
}

/**
 * Hashtag input component with tag chips
 * Allows users to add/remove hashtags with visual feedback
 */
export const HashtagInput = ({
    value = [],
    onChange,
    label = 'Hashtags',
    placeholder,
    helperText,
    maxTags = 10,
}: HashtagInputProps) => {
    const tCommon = useTranslations('common');
    const defaultPlaceholder = placeholder ?? tCommon('hashtagPlaceholder');
    const hashtagRules = tCommon('hashtagRules');
    const [inputValue, setInputValue] = useState('');

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && inputValue.trim()) {
            e.preventDefault();
            addHashtag(inputValue.trim());
        } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
            // Remove last tag on backspace if input is empty
            const lastTag = value[value.length - 1];
            if (lastTag) {
                removeHashtag(lastTag);
            }
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        // Remove # prefix, convert to lowercase, filter only valid chars (a-z, 0-9, _)
        const filtered = raw
            .replace(/^#/, '') // Remove leading #
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, ''); // Keep only valid characters
        setInputValue(filtered);
    };

    const addHashtag = (tag: string) => {
        // Remove # if user typed it
        const cleanTag = tag.replace(/^#/, '').toLowerCase();

        // Validate: English lowercase letters, numbers, and underscores only
        if (!/^[a-z0-9_]+$/.test(cleanTag)) {
            return;
        }

        // Check if already exists
        if (value.includes(cleanTag)) {
            setInputValue('');
            return;
        }

        // Check max limit
        if (value.length >= maxTags) {
            return;
        }

        onChange([...value, cleanTag]);
        setInputValue('');
    };

    const removeHashtag = (tag: string) => {
        onChange(value.filter(t => t !== tag));
    };

    const combinedHelperText = helperText 
        ? `${helperText}. ${hashtagRules} (${value.length}/${maxTags})`
        : `${hashtagRules} (${value.length}/${maxTags})`;

    return (
        <BrandFormControl
            label={label}
            helperText={combinedHelperText}
        >
            <div className="space-y-2">
                {/* Tags display */}
                {value.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {value.map((tag) => (
                            <div
                                key={tag}
                                className="flex items-center gap-1 px-2 py-1 bg-brand-primary/10 text-brand-primary rounded-md border border-brand-primary/20"
                            >
                                <Hash size={12} />
                                <span className="text-sm font-medium">{tag}</span>
                                <button
                                    onClick={() => removeHashtag(tag)}
                                    className="ml-1 p-0.5 hover:bg-brand-primary/20 rounded-full transition-colors"
                                    type="button"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Input field */}
                {value.length < maxTags && (
                    <BrandInput
                        value={inputValue}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder={defaultPlaceholder}
                        fullWidth
                    />
                )}
            </div>
        </BrandFormControl>
    );
};
