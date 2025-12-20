'use client';

import React, { useState, KeyboardEvent, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { BrandInput } from '@/components/ui/BrandInput';
import { BrandFormControl } from '@/components/ui/BrandFormControl';
import { X, Hash, AlertCircle } from 'lucide-react';

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
 * Follows social media best practices: allows # during typing, strips it on save
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

    // Check if current input contains invalid characters (excluding # which is allowed)
    const hasInvalidChars = useMemo(() => {
        if (!inputValue.trim()) return false;
        // Remove # prefix for validation check
        const textWithoutHash = inputValue.replace(/^#/, '');
        // Check if there are any invalid characters (not a-z, A-Z, 0-9, _)
        return /[^a-z0-9_]/i.test(textWithoutHash);
    }, [inputValue]);

    // Compute preview of how the hashtag will look when saved
    const previewTag = useMemo(() => {
        if (!inputValue.trim()) return null;
        
        // Apply the same cleaning logic as addHashtag
        let cleanTag = inputValue.replace(/^#+/, ''); // Remove one or more leading # symbols
        cleanTag = cleanTag.toLowerCase();
        cleanTag = cleanTag.replace(/[^a-z0-9_]/g, ''); // Filter invalid characters
        
        // Only show preview if there's at least one valid character
        return cleanTag.length > 0 ? cleanTag : null;
    }, [inputValue]);

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
        // Allow users to type freely, including # and any characters
        // Validation happens when adding the tag, not during typing
        setInputValue(e.target.value);
    };

    const addHashtag = (tag: string) => {
        // Strip # prefix if user typed it (it's optional)
        let cleanTag = tag.replace(/^#+/, ''); // Remove one or more leading # symbols
        
        // Convert to lowercase
        cleanTag = cleanTag.toLowerCase();
        
        // Filter out invalid characters (keep only a-z, 0-9, _)
        cleanTag = cleanTag.replace(/[^a-z0-9_]/g, '');

        // Validate: must have at least one valid character after cleaning
        if (!cleanTag || cleanTag.length === 0) {
            setInputValue('');
            return;
        }

        // Validate: English lowercase letters, numbers, and underscores only
        if (!/^[a-z0-9_]+$/.test(cleanTag)) {
            setInputValue('');
            return;
        }

        // Check if already exists
        if (value.includes(cleanTag)) {
            setInputValue('');
            return;
        }

        // Check max limit
        if (value.length >= maxTags) {
            setInputValue('');
            return;
        }

        onChange([...value, cleanTag]);
        setInputValue('');
    };

    const removeHashtag = (tag: string) => {
        onChange(value.filter(t => t !== tag));
    };

    // Build helper text with validation feedback
    const combinedHelperText = useMemo(() => {
        const parts: string[] = [];
        
        if (helperText) {
            parts.push(helperText);
        }
        
        parts.push(hashtagRules);
        
        if (hasInvalidChars && inputValue.trim()) {
            parts.push(tCommon('hashtagInvalidChars') || 'Invalid characters will be removed');
        }
        
        parts.push(`(${value.length}/${maxTags})`);
        
        return parts.join('. ');
    }, [helperText, hashtagRules, hasInvalidChars, inputValue, value.length, maxTags, tCommon]);

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
                    <div className="space-y-2">
                        <BrandInput
                            value={inputValue}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            placeholder={defaultPlaceholder}
                            fullWidth
                            className={hasInvalidChars && inputValue.trim() ? 'border-warning focus-visible:ring-warning/30' : ''}
                            rightIcon={hasInvalidChars && inputValue.trim() ? <AlertCircle size={16} className="text-warning" /> : undefined}
                        />
                        
                        {/* Dynamic preview of how the hashtag will look */}
                        {previewTag && !value.includes(previewTag) && (
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-base-content/60">
                                    {tCommon('hashtagPreview') || 'Preview:'}
                                </span>
                                <div className="flex items-center gap-1 px-2 py-1 bg-base-200 text-base-content rounded-md border border-base-300 opacity-75">
                                    <Hash size={12} />
                                    <span className="text-sm font-medium">{previewTag}</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </BrandFormControl>
    );
};
