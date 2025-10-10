// Community feature types

export interface Community {
    chatId: string;
    title: string;
    description?: string;
    icon?: string;
    tags?: string[];
    spaces: Space[];
    currencyNames?: Record<string, string>;
}

export interface Space {
    slug: string;
    name?: string;
    description?: string;
    icon?: string;
    deleted?: boolean;
    dimensions?: Dimension[];
}

export interface Dimension {
    id: string;
    name: string;
    weight?: number;
    icon?: string;
}

