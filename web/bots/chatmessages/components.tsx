import { useState } from 'react'
import { swr } from 'utils/fetch'
import { useChatMessages } from './client'

const ChatMessage = (props) => {
    const { raw, meta } = props
    if (!raw) return null

    const fromPhoto = meta?.fromPhoto

    const { from, date } = raw
    const { first_name, last_name } = from
    const name = `${first_name} ${last_name}`
    const dateVerbose = new Date(date * 1000).toLocaleString()
    const [comments, setComments] = useState(undefined)
    const showComments = (mode) => {}
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
                {false && <VoteBar forUrl={props.id.url} showComments={showComments} />}
            </div>
            {comments && <Comments forUrl={props.id.url}></Comments>}
        </div>
    )
}
export const Comments = ({ forUrl }) => {
    const [relations, upd] = swr('/api/relations', [], {
        params: {
            action: 'list',
            forUrl,
        },
    })
    const comments = relations.map((r) => r.comment?.text)

    return <div className="comments">{comments.map((c) => c.comment?.text)}</div>
}

export const VoteBar = ({ forUrl, showComments }) => {
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

export const ChatMessagesFeed = ({ chatId, hashtag, postId }: { chatId?: string; hashtag?: string; postId?: string }) => {
    const [messages] = useChatMessages(chatId, hashtag, postId)
    return (
        <div className="chatmessages">
            {messages
                .filter((m) => m.raw?.text)
                .map((m) => {
                    return <ChatMessage {...m} />
                })}
        </div>
    )
}
