'use client';

import { useState } from 'react'

export const AccordeonWithSummary = ({ children, title, summary }) => {
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
