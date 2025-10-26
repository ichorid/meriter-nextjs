// Community feature types

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

