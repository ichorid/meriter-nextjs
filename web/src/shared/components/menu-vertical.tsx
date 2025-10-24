'use client';

import { classList } from '@lib/classList'

interface MenuVerticalProps {
    title: string;
    subtitle: string;
    description: string;
    avatarUrl?: string;
    children: React.ReactNode;
    bottom: React.ReactNode;
}

export const MenuVertical: React.FC<MenuVerticalProps> = ({ 
    title, 
    subtitle, 
    description, 
    avatarUrl, 
    children, 
    bottom 
}) => (
    <div className="card-publication">
        <div className="inner">
            <div className="header">
                <div className="author">
                    <div className="avatar">
                        <img src={avatarUrl || undefined} />
                    </div>
                    <div className="info">
                        <div className="title">{title}</div>
                        <div className="subtitle">{subtitle}</div>
                    </div>
                </div>
                <div className="description">{description}</div>
            </div>
            <div className="content">{children}</div>
            <div className="bottom">{bottom}</div>
        </div>
    </div>
)
