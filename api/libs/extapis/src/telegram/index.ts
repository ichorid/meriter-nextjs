// Stub implementation for telegram types
export interface Update {
  update_id: number;
  message?: any;
  edited_message?: any;
  channel_post?: any;
  edited_channel_post?: any;
  inline_query?: any;
  chosen_inline_result?: any;
  callback_query?: any;
  shipping_query?: any;
  pre_checkout_query?: any;
  poll?: any;
  poll_answer?: any;
  my_chat_member?: any;
  chat_member?: any;
  chat_join_request?: any;
}

export interface Message {
  message_id: number;
  from?: any;
  sender_chat?: any;
  date: number;
  chat: any;
  forward_from?: any;
  forward_from_chat?: any;
  forward_from_message_id?: number;
  forward_signature?: string;
  forward_sender_name?: string;
  forward_date?: number;
  is_automatic_forward?: boolean;
  reply_to_message?: Message;
  via_bot?: any;
  edit_date?: number;
  has_protected_content?: boolean;
  media_group_id?: string;
  author_signature?: string;
  text?: string;
  entities?: any[];
  animation?: any;
  audio?: any;
  document?: any;
  photo?: any[];
  sticker?: any;
  video?: any;
  video_note?: any;
  voice?: any;
  caption?: string;
  caption_entities?: any[];
  contact?: any;
  dice?: any;
  game?: any;
  poll?: any;
  venue?: any;
  location?: any;
  new_chat_members?: any[];
  left_chat_member?: any;
  new_chat_title?: string;
  new_chat_photo?: any[];
  delete_chat_photo?: boolean;
  group_chat_created?: boolean;
  supergroup_chat_created?: boolean;
  channel_chat_created?: boolean;
  message_auto_delete_timer_changed?: any;
  migrate_to_chat_id?: number;
  migrate_from_chat_id?: number;
  pinned_message?: Message;
  invoice?: any;
  successful_payment?: any;
  connected_website?: string;
  passport_data?: any;
  proximity_alert_triggered?: any;
  video_chat_scheduled?: any;
  video_chat_started?: any;
  video_chat_ended?: any;
  video_chat_participants_invited?: any;
  web_app_data?: any;
  reply_markup?: any;
}

export interface User {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  added_to_attachment_menu?: boolean;
}

export interface Chat {
  id: number;
  type: string;
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  is_forum?: boolean;
  photo?: any;
  active_usernames?: string[];
  emoji_status_custom_emoji_id?: string;
  bio?: string;
  has_private_forwards?: boolean;
  has_restricted_voice_and_video_messages?: boolean;
  join_to_send_messages?: boolean;
  join_by_request?: boolean;
  description?: string;
  invite_link?: string;
  pinned_message?: Message;
  permissions?: any;
  slow_mode_delay?: number;
  message_auto_delete_time?: number;
  has_aggressive_anti_spam_enabled?: boolean;
  has_hidden_members?: boolean;
  has_protected_content?: boolean;
  sticker_set_name?: string;
  can_set_sticker_set?: boolean;
  linked_chat_id?: number;
  location?: any;
}