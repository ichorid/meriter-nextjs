'use client';

import React from 'react';
import { GluestackUIProviderWrapper } from '@/components/ui/gluestack-ui-provider';

export function GluestackWrapper({ children }: { children: React.ReactNode }) {
    return <GluestackUIProviderWrapper>{children}</GluestackUIProviderWrapper>;
}

