'use client';

import { useEffect } from 'react'
import { classList } from '@lib/classList'

interface SimplePageProps {
    children?: React.ReactNode;
    coverImageUrl?: string;
    blur?: number;
    className?: string;
}

export const SimplePage = ({ children, coverImageUrl, blur, className }: SimplePageProps) => {
    useEffect(() => {
        const sc = (e: Event) => {
            //   const r = Math.max(0, 1 - window.scrollY / 500)
            //     ;(document.querySelector('.simple-page-cover') as any).style.opacity = r
        }
        document.addEventListener('scroll', sc)
        return () => document.removeEventListener('scroll', sc)
    }, [])

    return (
        <div className={classList(className || '', 'w-full min-h-screen bg-base-200')}>
            {coverImageUrl && (
                <div
                    className="simple-page-cover absolute inset-0"
                    style={{ backgroundImage: `url(${coverImageUrl})`, filter: `blur(${blur ?? 20}px)brightness(50%)` }}></div>
            )}
            <div className="simple-page-overlay absolute inset-0 bg-base-200/50"></div>
            <div className="max-w-2xl mx-auto relative">{children}</div>
        </div>
    )
}
