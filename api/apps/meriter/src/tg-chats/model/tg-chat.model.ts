// Stub implementation for tg-chat model
export interface TgChat {
  id: string;
  chatId: string;
  title?: string;
  description?: string;
  isActive: boolean;
}

export interface TgChatMeta {
  chatId: string;
  title?: string;
  description?: string;
}
