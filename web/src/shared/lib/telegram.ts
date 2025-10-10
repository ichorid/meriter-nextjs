// Telegram utility functions

const isS3Enabled = () => {
    return process.env.NEXT_PUBLIC_S3_ENABLED !== 'false';
};

const telegramCdnUrl = process.env.NEXT_PUBLIC_TELEGRAM_AVATAR_BASE_URL || 'https://telegram.hb.bizmrg.com';

export function telegramGetAvatarLink(chat_id: string | number) {
    if (!chat_id || chat_id == "undefined" || !isS3Enabled()) return "";
    return `${telegramCdnUrl}/telegram_small_avatars/${chat_id}.jpg`;
}

export function telegramGetAvatarLinkUpd(chat_id: string | number) {
    if (!chat_id || chat_id == "undefined" || !isS3Enabled()) return "";
    // Note: The update functionality has been removed as it called the old API
    // If avatar update is needed, it should be done through the new API
    return `${telegramCdnUrl}/telegram_small_avatars/${chat_id}.jpg`;
}

