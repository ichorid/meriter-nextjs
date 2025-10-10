'use client';

import { useState } from 'react'

export const SectionToggle = ({ children, title, className, isOpened }: any) => {
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
