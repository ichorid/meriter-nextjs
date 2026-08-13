'use client';
import { config } from '@/config';
import { useUzzCommunityId } from '@/lib/use-uzz-community';
export function CommunityIdBanner() { const { communityId, loggedIn, sessionLoading } = useUzzCommunityId(); if (sessionLoading || communityId || config.defaultCommunityId || loggedIn) return null; return <div role="alert" className="border-b border-amber-500/40 bg-amber-500/15 px-4 py-2 text-center text-sm text-amber-100">Не удалось определить сообщество. Войдите или обратитесь к администратору.</div>; }
