// Type definitions for node-telegram-bot-api 0.51
// Project: https://github.com/yagop/node-telegram-bot-api
// Definitions by: Alex Muench <https://github.com/ammuench>
//                 Agadar <https://github.com/agadar>
//                 Giorgio Garasto <https://github.com/Dabolus>
//                 Kallu609 <https://github.com/Kallu609>
//                 XC-Zhang <https://github.com/XC-Zhang>
//                 AdityaThebe <https://github.com/adityathebe>
//                 Michael Orlov <https://github.com/MiklerGM>
//                 Alexander Ariutin <https://github.com/ariutin>
//                 XieJiSS <https://github.com/XieJiSS>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// TypeScript Version: 2.3

/// <reference types="node" />

import { EventEmitter } from 'events';
import { Stream, Readable } from 'stream';
import { ServerOptions } from 'https';

// Placeholder for old 'request' library Options type (no longer used)
type Options = any;

//export declare namespace TelegramTypes {
export interface TextListener {
  regexp: RegExp;
  callback(msg: Message, match: RegExpExecArray | null): void;
}

export interface ReplyListener {
  id: number;
  chatId: number | string;
  messageId: number | string;
  callback(msg: Message): void;
}

type ChatType = 'private' | 'group' | 'supergroup' | 'channel';

type ChatAction =
  | 'typing'
  | 'upload_photo'
  | 'record_video'
  | 'upload_video'
  | 'record_audio'
  | 'upload_audio'
  | 'upload_document'
  | 'find_location'
  | 'record_video_note'
  | 'upload_video_note';

type ChatMemberStatus =
  | 'creator'
  | 'administrator'
  | 'member'
  | 'restricted'
  | 'left'
  | 'kicked';

type DocumentMimeType = 'application/pdf' | 'application/zip';

type MessageType =
  | 'text'
  | 'animation'
  | 'audio'
  | 'channel_chat_created'
  | 'contact'
  | 'delete_chat_photo'
  | 'document'
  | 'game'
  | 'group_chat_created'
  | 'invoice'
  | 'left_chat_member'
  | 'location'
  | 'migrate_from_chat_id'
  | 'migrate_to_chat_id'
  | 'new_chat_members'
  | 'new_chat_photo'
  | 'new_chat_title'
  | 'passport_data'
  | 'photo'
  | 'pinned_message'
  | 'sticker'
  | 'successful_payment'
  | 'supergroup_chat_created'
  | 'video'
  | 'video_note'
  | 'voice';

type MessageEntityType =
  | 'mention'
  | 'hashtag'
  | 'bot_command'
  | 'url'
  | 'email'
  | 'bold'
  | 'italic'
  | 'code'
  | 'pre'
  | 'text_link'
  | 'text_mention';

type ParseMode = 'Markdown' | 'MarkdownV2' | 'HTML';

/// METHODS OPTIONS ///
export interface PollingOptions {
  interval?: string | number;
  autoStart?: boolean;
  params?: GetUpdatesOptions;
}

export interface WebHookOptions {
  host?: string;
  port?: number;
  key?: string;
  cert?: string;
  pfx?: string;
  autoOpen?: boolean;
  https?: ServerOptions;
  healthEndpoint?: string;
}

export interface ConstructorOptions {
  polling?: boolean | PollingOptions;
  webHook?: boolean | WebHookOptions;
  onlyFirstMatch?: boolean;
  request?: Options;
  baseApiUrl?: string;
  filepath?: boolean;
}

export interface StartPollingOptions extends ConstructorOptions {
  restart?: boolean;
}

export interface StopPollingOptions {
  cancel?: boolean;
  reason?: string;
}

export interface SetWebHookOptions {
  url?: string;
  certificate?: string | Stream;
  max_connections?: number;
  allowed_updates?: string[];
}

export interface GetUpdatesOptions {
  offset?: number;
  limit?: number;
  timeout?: number;
  allowed_updates?: string[];
}

export interface SendBasicOptions {
  disable_notification?: boolean;
  reply_to_message_id?: number;
  reply_markup?:
    | InlineKeyboardMarkup
    | ReplyKeyboardMarkup
    | ReplyKeyboardRemove
    | ForceReply;
}

export interface SendMessageOptions extends SendBasicOptions {
  parse_mode?: ParseMode;
  disable_web_page_preview?: boolean;
}

export interface AnswerInlineQueryOptions {
  cache_time?: number;
  is_personal?: boolean;
  next_offset?: string;
  switch_pm_text?: string;
  switch_pm_parameter?: string;
}

export interface ForwardMessageOptions {
  disable_notification?: boolean;
}

export interface SendPhotoOptions extends SendBasicOptions {
  parse_mode?: ParseMode;
  caption?: string;
}

export interface SendAudioOptions extends SendBasicOptions {
  parse_mode?: ParseMode;
  caption?: string;
  duration?: number;
  performer?: string;
  title?: string;
}

export interface SendAnimationOptions extends SendBasicOptions {
  parse_mode?: ParseMode;
  caption?: string;
  duration?: number;
  width?: number;
  height?: number;
}

export interface SendDocumentOptions extends SendBasicOptions {
  parse_mode?: ParseMode;
  caption?: string;
}

export interface SendMediaGroupOptions {
  disable_notification?: boolean;
  reply_to_message_id?: number;
}

export interface SendPollOptions extends SendBasicOptions {
  is_anonymous?: boolean;
  type?: PollType;
  allows_multiple_answers?: boolean;
  correct_option_id?: number;
  explanation?: string;
  explanation_parse_mode?: ParseMode;
  open_period?: number;
  close_date?: number;
  is_closed?: boolean;
}

export interface StopPollOptions {
  reply_markup?: InlineKeyboardMarkup;
}

type SendStickerOptions = SendBasicOptions;

export interface SendVideoOptions extends SendBasicOptions {
  parse_mode?: ParseMode;
  duration?: number;
  width?: number;
  height?: number;
  caption?: string;
}

export interface SendVoiceOptions extends SendBasicOptions {
  parse_mode?: ParseMode;
  caption?: string;
  duration?: number;
}

export interface SendVideoNoteOptions extends SendBasicOptions {
  duration?: number;
  length?: number;
}

type SendLocationOptions = SendBasicOptions;

type EditMessageLiveLocationOptions = EditMessageCaptionOptions;

type StopMessageLiveLocationOptions = EditMessageCaptionOptions;

export interface SendVenueOptions extends SendBasicOptions {
  foursquare_id?: string;
}

export interface SendContactOptions extends SendBasicOptions {
  last_name?: string;
  vcard?: string;
}

type SendGameOptions = SendBasicOptions;

export interface SendInvoiceOptions extends SendBasicOptions {
  provider_data?: string;
  photo_url?: string;
  photo_size?: number;
  photo_width?: number;
  photo_height?: number;
  need_name?: boolean;
  need_phone_number?: boolean;
  need_email?: boolean;
  need_shipping_address?: boolean;
  is_flexible?: boolean;
}

export interface CopyMessageOptions extends SendBasicOptions {
  caption?: string;
  parse_mode?: ParseMode;
  caption_entities?: MessageEntity[];
  allow_sending_without_reply?: boolean;
}

export interface RestrictChatMemberOptions {
  until_date?: number;
  can_send_messages?: boolean;
  can_send_media_messages?: boolean;
  can_send_polls?: boolean;
  can_send_other_messages?: boolean;
  can_add_web_page_previews?: boolean;
  can_change_info?: boolean;
  can_invite_users?: boolean;
  can_pin_messages?: boolean;
}

export interface PromoteChatMemberOptions {
  can_change_info?: boolean;
  can_post_messages?: boolean;
  can_edit_messages?: boolean;
  can_delete_messages?: boolean;
  can_invite_users?: boolean;
  can_restrict_members?: boolean;
  can_pin_messages?: boolean;
  can_promote_members?: boolean;
}

export interface AnswerCallbackQueryOptions {
  callback_query_id: string;
  text?: string;
  show_alert?: boolean;
  url?: string;
  cache_time?: number;
}

export interface EditMessageTextOptions extends EditMessageCaptionOptions {
  parse_mode?: ParseMode;
  disable_web_page_preview?: boolean;
}

export interface EditMessageCaptionOptions
  extends EditMessageReplyMarkupOptions {
  reply_markup?: InlineKeyboardMarkup;
  parse_mode?: ParseMode;
  caption_entities?: MessageEntity[];
}

export interface EditMessageReplyMarkupOptions {
  chat_id?: number | string;
  message_id?: number;
  inline_message_id?: string;
}

export interface GetUserProfilePhotosOptions {
  offset?: number;
  limit?: number;
}

export interface SetGameScoreOptions {
  force?: boolean;
  disable_edit_message?: boolean;
  chat_id?: number;
  message_id?: number;
  inline_message_id?: string;
}

export interface GetGameHighScoresOptions {
  chat_id?: number;
  message_id?: number;
  inline_message_id?: string;
}

export interface AnswerShippingQueryOptions {
  shipping_options?: ShippingOption[];
  error_message?: string;
}

export interface AnswerPreCheckoutQueryOptions {
  error_message?: string;
}

export interface SendDiceOptions extends SendBasicOptions {
  emoji?: string;
}

/// TELEGRAM TYPES ///
export interface PassportFile {
  file_id: string;
  file_size: number;
  file_date: number;
}

export interface EncryptedPassportElement {
  type: string;
  data?: string;
  phone_number?: string;
  email?: string;
  files?: PassportFile[];
  front_side?: PassportFile;
  reverse_side?: PassportFile;
  selfie?: PassportFile;
  translation?: PassportFile[];
  hash: string;
}

export interface EncryptedCredentials {
  data: string;
  hash: string;
  secret: string;
}

export interface PassportData {
  data: EncryptedPassportElement[];
  credentials: EncryptedCredentials;
}

export interface Update {
  update_id: number;
  message?: Message;
  edited_message?: Message;
  channel_post?: Message;
  edited_channel_post?: Message;
  inline_query?: InlineQuery;
  chosen_inline_result?: ChosenInlineResult;
  callback_query?: CallbackQuery;
  shipping_query?: ShippingQuery;
  pre_checkout_query?: PreCheckoutQuery;
  my_chat_member?: ChatMemberUpdated;
}

export interface WebhookInfo {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
  max_connections?: number;
  allowed_updates?: string[];
}

export interface User {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface Chat {
  id: number;
  type: ChatType;
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo?: ChatPhoto;
  description?: string;
  invite_link?: string;
  pinned_message?: Message;
  permissions?: ChatPermissions;
  can_set_sticker_set?: boolean;
  sticker_set_name?: string;
  /**
   * @deprecated since version Telegram Bot API 4.4 - July 29, 2019
   */
  all_members_are_administrators?: boolean;
}

export interface Message {
  message_id: number;
  from?: User;
  date: number;
  chat: Chat;
  forward_from?: User;
  forward_from_chat?: Chat;
  forward_from_message_id?: number;
  forward_signature?: string;
  forward_sender_name?: string;
  forward_date?: number;
  reply_to_message?: Message;
  edit_date?: number;
  media_group_id?: string;
  author_signature?: string;
  text?: string;
  entities?: MessageEntity[];
  caption_entities?: MessageEntity[];
  audio?: Audio;
  document?: Document;
  animation?: Animation;
  game?: Game;
  photo?: PhotoSize[];
  sticker?: Sticker;
  video?: Video;
  voice?: Voice;
  video_note?: VideoNote;
  caption?: string;
  contact?: Contact;
  location?: Location;
  venue?: Venue;
  poll?: Poll;
  new_chat_members?: User[];
  left_chat_member?: User;
  new_chat_title?: string;
  new_chat_photo?: PhotoSize[];
  delete_chat_photo?: boolean;
  group_chat_created?: boolean;
  supergroup_chat_created?: boolean;
  channel_chat_created?: boolean;
  migrate_to_chat_id?: number;
  migrate_from_chat_id?: number;
  pinned_message?: Message;
  invoice?: Invoice;
  successful_payment?: SuccessfulPayment;
  connected_website?: string;
  passport_data?: PassportData;
  reply_markup?: InlineKeyboardMarkup;
}

export interface MessageEntity {
  type: MessageEntityType;
  offset: number;
  length: number;
  url?: string;
  user?: User;
}

export interface FileBase {
  file_id: string;
  file_size?: number;
}

export interface PhotoSize extends FileBase {
  width: number;
  height: number;
}

export interface Audio extends FileBase {
  duration: number;
  performer?: string;
  title?: string;
  mime_type?: string;
  thumb?: PhotoSize;
}

export interface Document extends FileBase {
  thumb?: PhotoSize;
  file_name?: string;
  mime_type?: string;
}

export interface Video extends FileBase {
  width: number;
  height: number;
  duration: number;
  thumb?: PhotoSize;
  mime_type?: string;
}

export interface Voice extends FileBase {
  duration: number;
  mime_type?: string;
}

export interface InputMediaBase {
  media: string;
  caption?: string;
  parse_mode?: ParseMode;
}

export interface InputMediaPhoto extends InputMediaBase {
  type: 'photo';
}

export interface InputMediaVideo extends InputMediaBase {
  type: 'video';
  width?: number;
  height?: number;
  duration?: number;
  supports_streaming?: boolean;
}

type InputMedia = InputMediaPhoto | InputMediaVideo;

export interface VideoNote extends FileBase {
  length: number;
  duration: number;
  thumb?: PhotoSize;
}

export interface Contact {
  phone_number: string;
  first_name: string;
  last_name?: string;
  user_id?: number;
  vcard?: string;
}

export interface Location {
  longitude: number;
  latitude: number;
}

export interface Venue {
  location: Location;
  title: string;
  address: string;
  foursquare_id?: string;
  foursquare_type?: string;
}

type PollType = 'regular' | 'quiz';

export interface PollAnswer {
  poll_id: string;
  user: User;
  option_ids: number[];
}

export interface PollOption {
  text: string;
  voter_count: number;
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  is_closed: boolean;
  is_anonymous: boolean;
  allows_multiple_answers: boolean;
  type: PollType;
  total_voter_count: number;
}

export interface UserProfilePhotos {
  total_count: number;
  photos: PhotoSize[][];
}

export interface File extends FileBase {
  file_path?: string;
}

export interface ReplyKeyboardMarkup {
  keyboard: KeyboardButton[][];
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
  selective?: boolean;
}

export interface KeyboardButton {
  text: string;
  request_contact?: boolean;
  request_location?: boolean;
}

export interface ReplyKeyboardRemove {
  remove_keyboard: boolean;
  selective?: boolean;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export interface InlineKeyboardButton {
  text: string;
  url?: string;
  login_url?: LoginUrl;
  callback_data?: string;
  switch_inline_query?: string;
  switch_inline_query_current_chat?: string;
  callback_game?: CallbackGame;
  pay?: boolean;
}

export interface LoginUrl {
  url: string;
  forward_text?: string;
  bot_username?: string;
  request_write_acces?: boolean;
}

export interface CallbackQuery {
  id: string;
  from: User;
  message?: Message;
  inline_message_id?: string;
  chat_instance: string;
  data?: string;
  game_short_name?: string;
}

export interface ForceReply {
  force_reply: boolean;
  selective?: boolean;
}

export interface ChatPhoto {
  small_file_id: string;
  big_file_id: string;
}

export interface ChatMember {
  user: User;
  status: ChatMemberStatus;
  until_date?: number;
  can_be_edited?: boolean;
  can_post_messages?: boolean;
  can_edit_messages?: boolean;
  can_delete_messages?: boolean;
  can_restrict_members?: boolean;
  can_promote_members?: boolean;
  can_change_info?: boolean;
  can_invite_users?: boolean;
  can_pin_messages?: boolean;
  is_member?: boolean;
  can_send_messages?: boolean;
  can_send_media_messages?: boolean;
  can_send_polls: boolean;
  can_send_other_messages?: boolean;
  can_add_web_page_previews?: boolean;
}

export interface ChatMemberUpdated {
  chat: Chat;
  from: User;
  date: number;
  old_chat_member: ChatMember;
  new_chat_member: ChatMember;
}

export interface ChatPermissions {
  can_send_messages?: boolean;
  can_send_media_messages?: boolean;
  can_send_polls?: boolean;
  can_send_other_messages?: boolean;
  can_add_web_page_previews?: boolean;
  can_change_info?: boolean;
  can_invite_users?: boolean;
  can_pin_messages?: boolean;
}

export interface Sticker {
  file_id: string;
  file_unique_id: string;
  is_animated: boolean;
  width: number;
  height: number;
  thumb?: PhotoSize;
  emoji?: string;
  set_name?: string;
  mask_position?: MaskPosition;
  file_size?: number;
}

export interface StickerSet {
  name: string;
  title: string;
  contains_masks: boolean;
  stickers: Sticker[];
}

export interface MaskPosition {
  point: string;
  x_shift: number;
  y_shift: number;
  scale: number;
}

export interface InlineQuery {
  id: string;
  from: User;
  location?: Location;
  query: string;
  offset: string;
}

export interface InlineQueryResultBase {
  id: string;
  reply_markup?: InlineKeyboardMarkup;
}

export interface InlineQueryResultArticle extends InlineQueryResultBase {
  type: 'article';
  title: string;
  input_message_content: InputMessageContent;
  url?: string;
  hide_url?: boolean;
  description?: string;
  thumb_url?: string;
  thumb_width?: number;
  thumb_height?: number;
}

export interface InlineQueryResultPhoto extends InlineQueryResultBase {
  type: 'photo';
  photo_url: string;
  thumb_url: string;
  photo_width?: number;
  photo_height?: number;
  title?: string;
  description?: string;
  caption?: string;
  input_message_content?: InputMessageContent;
}

export interface InlineQueryResultGif extends InlineQueryResultBase {
  type: 'gif';
  gif_url: string;
  gif_width?: number;
  gif_height?: number;
  gif_duration?: number;
  thumb_url?: string;
  title?: string;
  caption?: string;
  input_message_content?: InputMessageContent;
}

export interface InlineQueryResultMpeg4Gif extends InlineQueryResultBase {
  type: 'mpeg4_gif';
  mpeg4_url: string;
  mpeg4_width?: number;
  mpeg4_height?: number;
  mpeg4_duration?: number;
  thumb_url?: string;
  title?: string;
  caption?: string;
  input_message_content?: InputMessageContent;
}

export interface InlineQueryResultVideo extends InlineQueryResultBase {
  type: 'video';
  video_url: string;
  mime_type: string;
  thumb_url: string;
  title: string;
  caption?: string;
  video_width?: number;
  video_height?: number;
  video_duration?: number;
  description?: string;
  input_message_content?: InputMessageContent;
}

export interface InlineQueryResultAudio extends InlineQueryResultBase {
  type: 'audio';
  audio_url: string;
  title: string;
  caption?: string;
  performer?: string;
  audio_duration?: number;
  input_message_content?: InputMessageContent;
}

export interface InlineQueryResultVoice extends InlineQueryResultBase {
  type: 'voice';
  voice_url: string;
  title: string;
  caption?: string;
  voice_duration?: number;
  input_message_content?: InputMessageContent;
}

export interface InlineQueryResultDocument extends InlineQueryResultBase {
  type: 'document';
  title: string;
  caption?: string;
  document_url: string;
  mime_type: string;
  description?: string;
  input_message_content?: InputMessageContent;
  thumb_url?: string;
  thumb_width?: number;
  thumb_height?: number;
}

export interface InlineQueryResultLocationBase extends InlineQueryResultBase {
  latitude: number;
  longitude: number;
  title: string;
  input_message_content?: InputMessageContent;
  thumb_url?: string;
  thumb_width?: number;
  thumb_height?: number;
}

export interface InlineQueryResultLocation
  extends InlineQueryResultLocationBase {
  type: 'location';
}

export interface InlineQueryResultVenue extends InlineQueryResultLocationBase {
  type: 'venue';
  address: string;
  foursquare_id?: string;
}

export interface InlineQueryResultContact extends InlineQueryResultBase {
  type: 'contact';
  phone_number: string;
  first_name: string;
  last_name?: string;
  input_message_content?: InputMessageContent;
  thumb_url?: string;
  thumb_width?: number;
  thumb_height?: number;
}

export interface InlineQueryResultGame extends InlineQueryResultBase {
  type: 'game';
  game_short_name: string;
}

export interface InlineQueryResultCachedPhoto extends InlineQueryResultBase {
  type: 'photo';
  photo_file_id: string;
  title?: string;
  description?: string;
  caption?: string;
  input_message_content?: InputMessageContent;
}

export interface InlineQueryResultCachedGif extends InlineQueryResultBase {
  type: 'gif';
  gif_file_id: string;
  title?: string;
  caption?: string;
  input_message_content?: InputMessageContent;
}

export interface InlineQueryResultCachedMpeg4Gif extends InlineQueryResultBase {
  type: 'mpeg4_gif';
  mpeg4_file_id: string;
  title?: string;
  caption?: string;
  input_message_content?: InputMessageContent;
}

export interface InlineQueryResultCachedSticker extends InlineQueryResultBase {
  type: 'sticker';
  sticker_file_id: string;
  input_message_content?: InputMessageContent;
}

export interface InlineQueryResultCachedDocument extends InlineQueryResultBase {
  type: 'document';
  title: string;
  document_file_id: string;
  description?: string;
  caption?: string;
  input_message_content?: InputMessageContent;
}

export interface InlineQueryResultCachedVideo extends InlineQueryResultBase {
  type: 'video';
  video_file_id: string;
  title: string;
  description?: string;
  caption?: string;
  input_message_content?: InputMessageContent;
}

export interface InlineQueryResultCachedVoice extends InlineQueryResultBase {
  type: 'voice';
  voice_file_id: string;
  title: string;
  caption?: string;
  input_message_content?: InputMessageContent;
}

export interface InlineQueryResultCachedAudio extends InlineQueryResultBase {
  type: 'audio';
  audio_file_id: string;
  caption?: string;
  input_message_content?: InputMessageContent;
}

type InlineQueryResult =
  | InlineQueryResultCachedAudio
  | InlineQueryResultCachedDocument
  | InlineQueryResultCachedGif
  | InlineQueryResultCachedMpeg4Gif
  | InlineQueryResultCachedPhoto
  | InlineQueryResultCachedSticker
  | InlineQueryResultCachedVideo
  | InlineQueryResultCachedVoice
  | InlineQueryResultArticle
  | InlineQueryResultAudio
  | InlineQueryResultContact
  | InlineQueryResultGame
  | InlineQueryResultDocument
  | InlineQueryResultGif
  | InlineQueryResultLocation
  | InlineQueryResultMpeg4Gif
  | InlineQueryResultPhoto
  | InlineQueryResultVenue
  | InlineQueryResultVideo
  | InlineQueryResultVoice;

type InputMessageContent = object;

export interface InputTextMessageContent extends InputMessageContent {
  message_text: string;
  parse_mode?: ParseMode;
  disable_web_page_preview?: boolean;
}

export interface InputLocationMessageContent extends InputMessageContent {
  latitude: number;
  longitude: number;
}

export interface InputVenueMessageContent extends InputLocationMessageContent {
  title: string;
  address: string;
  foursquare_id?: string;
}

export interface InputContactMessageContent extends InputMessageContent {
  phone_number: string;
  first_name: string;
  last_name?: string;
}

export interface ChosenInlineResult {
  result_id: string;
  from: User;
  location?: Location;
  inline_message_id?: string;
  query: string;
}

export interface ResponseParameters {
  migrate_to_chat_id?: number;
  retry_after?: number;
}

export interface LabeledPrice {
  label: string;
  amount: number;
}

export interface Invoice {
  title: string;
  description: string;
  start_parameter: string;
  currency: string;
  total_amount: number;
}

export interface ShippingAddress {
  country_code: string;
  state: string;
  city: string;
  street_line1: string;
  street_line2: string;
  post_code: string;
}

export interface OrderInfo {
  name?: string;
  phone_number?: string;
  email?: string;
  shipping_address?: ShippingAddress;
}

export interface ShippingOption {
  id: string;
  title: string;
  prices: LabeledPrice[];
}

export interface SuccessfulPayment {
  currency: string;
  total_amount: number;
  invoice_payload: string;
  shipping_option_id?: string;
  order_info?: OrderInfo;
  telegram_payment_charge_id: string;
  provider_payment_charge_id: string;
}

export interface ShippingQuery {
  id: string;
  from: User;
  invoice_payload: string;
  shipping_address: ShippingAddress;
}

export interface PreCheckoutQuery {
  id: string;
  from: User;
  currency: string;
  total_amount: number;
  invoice_payload: string;
  shipping_option_id?: string;
  order_info?: OrderInfo;
}

export interface Game {
  title: string;
  description: string;
  photo: PhotoSize[];
  text?: string;
  text_entities?: MessageEntity[];
  animation?: Animation;
}

export interface Animation extends FileBase {
  width: number;
  height: number;
  duration: number;
  thumb?: PhotoSize;
  file_name?: string;
  mime_type?: string;
}

type CallbackGame = object;

export interface GameHighScore {
  position: number;
  user: User;
  score: number;
}

export interface Metadata {
  type?: MessageType;
}

export interface BotCommand {
  command: string;
  description: string;
}

export interface MessageId {
  message_id: number;
}
//}
