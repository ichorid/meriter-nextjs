// Telegram utility functions
import { config } from '@/config';

const isS3Enabled = () => {
    return config.s3.enabled;
};

const telegramCdnUrl = config.telegram.avatarBaseUrl;

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

