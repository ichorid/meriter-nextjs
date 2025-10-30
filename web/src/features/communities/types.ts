// Community feature types
// DEPRECATED: Community type should be imported from @meriter/shared-types
// Use: import type { Community } from '@meriter/shared-types';

// Legacy Community type - DO NOT USE, use @meriter/shared-types instead
export interface Community {
    chatId: string;
    title: string;
    description?: string;
    icon?: string;
    tags?: string[];
    currencyNames?: Record<string, string>;
}

export interface Dimension {
    id: string;
    name: string;
    weight?: number;
    icon?: string;
}

