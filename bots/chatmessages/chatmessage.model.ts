import { mongooseConnect, mongooseSchema, uuid } from '../../utils/mongooseconnect'

const connection = mongooseConnect('meriterra/mcs/neptune/meriterra')

//console.log(connection);
export const ChatMessage =
    connection?.models?.ChatMessage ||
    connection?.model(
        'ChatMessage',
        new mongooseSchema({
            provider: String,
            uuid: { type: String, default: uuid },
            type: String,
            url: String,
            source: String,

            bot: String,
            meta: Object,
            raw: Object,
            //       telegramRepliesAttachments: Object,
        })
    )
export interface IChatMessageMeta {
    fromPhoto?: string
}

export interface IChatMessageRaw {
    from?: {
        first_name?: string
        last_name?: string
    }
    date?: number
    text?: string
}

export interface IChatMessage {
    _id?: string
    uuid?: string
    type: string
    url: string
    source?: string

    provider?: string
    bot?: string
    meta?: IChatMessageMeta
    raw?: IChatMessageRaw
    //rawRepliesAttachments?: object;
}
