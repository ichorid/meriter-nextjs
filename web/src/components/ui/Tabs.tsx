'use client';

import React from 'react';

export interface Tab {
    id: string;
    label: string;
    icon?: React.ReactNode;
}

interface TabsProps {
    tabs: Tab[];
    activeTab: string;
    onChange: (tabId: string) => void;
    className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
    tabs,
    activeTab,
    onChange,
    className = '',
}) => {
    return (
        <div className={`flex gap-2 border-b border-base-content/10 ${className}`}>
            {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                    <button
                        key={tab.id}
                        onClick={() => onChange(tab.id)}
                        className={`
                            relative px-4 py-3 text-sm font-medium transition-colors
                            ${isActive
                                ? 'text-brand-primary border-b-2 border-brand-primary'
                                : 'text-base-content/60 hover:text-base-content/80'
                            }
                        `}
                    >
                        <div className="flex items-center gap-2">
                            {tab.icon && <span className="flex-shrink-0">{tab.icon}</span>}
                            <span>{tab.label}</span>
                        </div>
                    </button>
                );
            })}
        </div>
    );
};
