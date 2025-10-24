'use client';

import { useState } from 'react'
import dynamic from 'next/dynamic'
import type { EmojiClickData } from 'emoji-picker-react'
import { useTranslations } from 'next-intl'

// Dynamically import EmojiPicker to avoid SSR issues
const EmojiPicker = dynamic(
    () => import('emoji-picker-react'),
    { ssr: false }
)

export const IconPicker = ({ icon, cta, setIcon }) => {
    const t = useTranslations('pages');
    const [opened, setOpened] = useState(false)

    const onEmojiClick = (emojiData: EmojiClickData) => {
        // Convert emoji to data URL for consistent storage
        const emoji = emojiData.emoji
        const svgDataUrl = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="75" font-size="75">${encodeURIComponent(emoji)}</text></svg>`
        setIcon(svgDataUrl)
        setOpened(false)
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                {icon && (
                    <div className="w-12 h-12 flex items-center justify-center border border-base-300 rounded-lg bg-base-200">
                        <img src={icon} className="w-8 h-8 object-contain" alt="selected emoji" />
                    </div>
                )}
                <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setOpened(!opened)}
                >
                    {icon ? t('iconPicker.changeIcon') : cta}
                </button>
            </div>
            
            {opened && (
                <div className="relative">
                    <div className="card bg-base-100 border border-base-300 shadow-lg p-2">
                        <div className="flex justify-between items-center mb-2 px-2">
                            <span className="text-sm font-medium">{t('iconPicker.selectEmoji')}</span>
                            <button
                                type="button"
                                className="btn btn-ghost btn-xs btn-circle"
                                onClick={() => setOpened(false)}
                            >
                                ✕
                            </button>
                        </div>
                        <EmojiPicker
                            onEmojiClick={onEmojiClick}
                            width="100%"
                            height={400}
                            searchPlaceHolder={t('iconPicker.searchPlaceholder')}
                            previewConfig={{
                                showPreview: false
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}
