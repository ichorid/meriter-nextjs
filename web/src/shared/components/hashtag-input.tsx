'use client';

import React, { useState, KeyboardEvent, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/shadcn/input';
import { BrandFormControl } from '@/components/ui/BrandFormControl';
import { cn } from '@/lib/utils';
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

    // Check if current input contains invalid characters (excluding #, ;, and , which are allowed)
    const hasInvalidChars = useMemo(() => {
        if (!inputValue.trim()) return false;
        // Remove # prefix and separators for validation check
        const textWithoutHash = inputValue.replace(/^#/, '').replace(/[;,]/g, '');
        // Check if there are any invalid characters (not a-z, A-Z, а-я, А-Я, ё, Ё, 0-9, _)
        // Note: ; and , are allowed as separators
        return /[^a-zа-яё0-9_]/i.test(textWithoutHash);
    }, [inputValue]);

    // Compute preview of how the hashtag will look when saved
    const previewTag = useMemo(() => {
        if (!inputValue.trim()) return null;
        
        // Apply the same cleaning logic as addHashtag
        let cleanTag = inputValue.replace(/^#+/, ''); // Remove one or more leading # symbols
        // Convert to lowercase (works for both Latin and Cyrillic)
        cleanTag = cleanTag.toLowerCase();
        // Filter invalid characters (keep a-z, а-я, ё, 0-9, _)
        cleanTag = cleanTag.replace(/[^a-zа-яё0-9_]/g, '');
        
        // Only show preview if there's at least one valid character
        return cleanTag.length > 0 ? cleanTag : null;
    }, [inputValue]);

    const addHashtag = (tag: string) => {
        // Strip # prefix if user typed it (it's optional)
        let cleanTag = tag.replace(/^#+/, ''); // Remove one or more leading # symbols
        
        // Convert to lowercase (works for both Latin and Cyrillic)
        cleanTag = cleanTag.toLowerCase();
        
        // Filter out invalid characters (keep only a-z, а-я, ё, 0-9, _)
        cleanTag = cleanTag.replace(/[^a-zа-яё0-9_]/g, '');

        // Validate: must have at least one valid character after cleaning
        if (!cleanTag || cleanTag.length === 0) {
            setInputValue('');
            return;
        }

        // Validate: letters (Latin or Cyrillic), numbers, and underscores only
        if (!/^[a-zа-яё0-9_]+$/.test(cleanTag)) {
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
        const newValue = e.target.value;
        
        // Check if input contains separator characters (; or ,)
        if (newValue.includes(';') || newValue.includes(',')) {
            // Split by both separators
            const parts = newValue.split(/[;,]/);
            
            // Process all parts except the last one (which might be incomplete)
            const partsToProcess = parts.slice(0, -1);
            const remainingPart = parts[parts.length - 1] || '';
            
            // Process parts and collect new tags
            const newTags: string[] = [];
            partsToProcess.forEach(part => {
                const trimmedPart = part.trim();
                if (trimmedPart) {
                    // Apply the same cleaning logic as addHashtag
                    let cleanTag = trimmedPart.replace(/^#+/, ''); // Remove one or more leading # symbols
                    cleanTag = cleanTag.toLowerCase(); // Works for both Latin and Cyrillic
                    cleanTag = cleanTag.replace(/[^a-zа-яё0-9_]/g, ''); // Filter invalid characters (keep a-z, а-я, ё, 0-9, _)
                    
                    // Validate and add if valid
                    if (cleanTag && cleanTag.length > 0 && /^[a-zа-яё0-9_]+$/.test(cleanTag) && !value.includes(cleanTag) && !newTags.includes(cleanTag)) {
                        if (value.length + newTags.length < maxTags) {
                            newTags.push(cleanTag);
                        }
                    }
                }
            });
            
            // Add all new tags at once
            if (newTags.length > 0) {
                onChange([...value, ...newTags]);
            }
            
            // Keep the remaining part in the input field (if any)
            setInputValue(remainingPart);
        } else {
            // Normal typing - just update the input value
            setInputValue(newValue);
        }
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
                                className="flex items-center gap-1 px-2 py-1 bg-brand-primary/10 text-brand-primary rounded-md shadow-none"
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
                        <div className="relative w-full">
                            <Input
                                value={inputValue}
                                onChange={handleInputChange}
                                onKeyDown={handleKeyDown}
                                placeholder={defaultPlaceholder}
                                className={cn(
                                    'h-11 rounded-xl w-full',
                                    hasInvalidChars && inputValue.trim() && 'border-warning focus-visible:ring-warning/30 pr-10',
                                    !hasInvalidChars || !inputValue.trim() ? '' : 'pr-10'
                                )}
                            />
                            {hasInvalidChars && inputValue.trim() && (
                                <AlertCircle size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-warning pointer-events-none z-10" />
                            )}
                        </div>
                        
                        {/* Dynamic preview of how the hashtag will look */}
                        {previewTag && !value.includes(previewTag) && (
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-base-content/60">
                                    {tCommon('hashtagPreview') || 'Preview:'}
                                </span>
                                <div className="flex items-center gap-1 px-2 py-1 bg-base-200 text-base-content rounded-md shadow-none opacity-75">
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
