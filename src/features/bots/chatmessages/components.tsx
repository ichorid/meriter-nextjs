import { useState } from 'react'
import { swr } from 'utils/fetch'
import { useChatMessages } from './client'
import { IChatMessage, IChatMessageMeta, IChatMessageRaw } from './chatmessage.model'

const ChatMessage = (props: IChatMessage) => {
    const { raw, meta } = props
    if (!raw) return null

    const fromPhoto = meta?.fromPhoto

    const { from, date } = raw
    if (!from) return null
    const { first_name, last_name } = from
    const name = `${first_name} ${last_name}`
    const dateVerbose = date ? new Date(date * 1000).toLocaleString() : ''
    const [comments, setComments] = useState(undefined)
    const showComments = (mode: string) => {}
    return (
        <div className="chatmessage-wrapper">
            <div className="chatmessage">
                <div className="header">
                    <div className="author">
                        <div className="avatar">
                            <img src={fromPhoto} />
                        </div>
                        <div className="info">
                            <div className="name">{name}</div>
                            <div className="date">{dateVerbose}</div>
                        </div>
                    </div>
                    <div className="category"></div>
                </div>
                <div className="text">{props?.raw?.text}</div>
                {false && <VoteBar forUrl={props.url} showComments={showComments} />}
            </div>
            {comments && <Comments forUrl={props.url}></Comments>}
        </div>
    )
}
export const Comments = ({ forUrl }: { forUrl: string }) => {
    const [relations, upd] = swr('/api/relations', [], {
        params: {
            action: 'list',
            forUrl,
        },
    })
    const comments = relations.map((r: any) => r.comment?.text)

    return <div className="comments">{comments.map((c: any) => c.comment?.text)}</div>
}

export const VoteBar = ({ forUrl, showComments }: { forUrl: string; showComments: (mode: string) => void }) => {
    const [current, upd] = swr('/api/relations', [], {
        params: {
            action: 'totalFromMe',
            forUrl,
        },
    })

    return (
        <div className="vote-bar">
            <div className="left">
                <span
                    className="comments"
                    onClick={() => {
                        showComments('showonly')
                    }}></span>
            </div>
            <div className="right">
                <span
                    className="minus"
                    onClick={() => {
                        showComments('minus')
                    }}></span>
                <span className="total"></span>
                <span
                    className="plus"
                    onClick={() => {
                        showComments('plus')
                    }}></span>
            </div>
        </div>
    )
}

export const ChatMessagesFeed = ({ chatId, hashtag, postId }: { chatId?: string; hashtag?:string; postId?: string }) => {
    const [messages] = useChatMessages(chatId ?? '', hashtag ?? '', postId ?? '')
    return (
        <div className="chatmessages">
            {messages
                .filter((m: IChatMessage) => m.raw?.text)
                .map((m: IChatMessage) => {
                    return <ChatMessage {...m} />
                })}
        </div>
    )
}
