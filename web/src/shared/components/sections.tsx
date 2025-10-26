'use client';

import { useState } from 'react'

interface SectionToggleProps {
    children?: React.ReactNode;
    title?: string;
    className?: string;
    isOpened?: boolean;
}

export const SectionToggle = ({ children, title, className, isOpened }: SectionToggleProps) => {
    const [opened, setOpened] = useState(isOpened === false ? false : true)
    return (
        <section className={className}>
            <div
                className="title clickable"
                onClick={() => {
                    setOpened(true)
                }}>
                {title}
            </div>
            {opened && <div className="children">{children}</div>}
        </section>
    )
}
