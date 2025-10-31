'use client';

import { useState } from 'react'

interface AccordeonWithSummaryProps {
    children: React.ReactNode;
    title: string;
    summary: string[];
}

export const AccordeonWithSummary: React.FC<AccordeonWithSummaryProps> = ({ children, title, summary }) => {
    const [opened, setOpened] = useState(false)
    return (
        <div className="accordeon-with-summary">
            <div
                className="title clickable"
                onClick={() => {
                    setOpened(!opened)
                }}>
                {title}
            </div>
            {!opened && (
                <div
                    className="summary clickable"
                    onClick={() => {
                        setOpened(!opened)
                    }}>
                    {summary.map((s, i) => (
                        <span className="item" key={i}>
                            {s}
                        </span>
                    ))}
                </div>
            )}
            {opened && <div className="content">{children}</div>}
            <div className="line-shadow mar-top-20"></div>
        </div>
    )
}
