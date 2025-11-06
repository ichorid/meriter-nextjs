import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

export interface UsePollTimeRemainingOptions {
    expiresAt: string | Date;
}

export function usePollTimeRemaining({ expiresAt }: UsePollTimeRemainingOptions) {
    const t = useTranslations('polls');
    
    return useMemo(() => {
        const now = new Date();
        const expires = new Date(expiresAt);
        const diff = expires.getTime() - now.getTime();
        
        if (diff <= 0) return t('finished');

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (days > 0) return `${days} ${t('days')} ${hours} ${t('hours')}`;
        if (hours > 0) return `${hours} ${t('hours')} ${minutes} ${t('minutes')}`;
        return `${minutes} ${t('minutes')}`;
    }, [expiresAt, t]);
}

