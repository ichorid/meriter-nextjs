// Dimension types for communities
export enum iDimensionCatEnum {
    QUALITY = 'quality',
    IMPACT = 'impact',
    CREATIVITY = 'creativity',
    EFFORT = 'effort'
}

export interface DimensionProto {
    enum: string[];
    [key: string]: any;
}

export interface iDimensionTags {
    dimensions: {
        [dimensionSlug: string]: DimensionProto;
    };
    [key: string]: any;
}

export interface iDimensionConfig {
    [level: string]: iDimensionTags;
}

export interface iDimensions {
    [key: string]: number | string;
}

