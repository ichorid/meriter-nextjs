import { useEffect, useState } from 'react'
import { SectionToggle } from 'utils/ui/sections'
import useDebounce from 'utils/debounce'
import { apiPOST, useApiPOST } from 'utils/fetch'
import { getIconsLogojoy } from 'utils/getIcon'
import { etv } from 'utils/input'
import { fillDefined } from 'utils/object'
import { IChat } from './chat.model'
import { IconPicker } from 'utils/components/iconpicker'

export const ChatsManagedByMe = () => {
    return <div></div>
}

export const ChatsList = ({ onSelectChat }: { onSelectChat: (chat: IChat, keyword: string) => void }) => {
    const [chats] = useApiPOST('/api/chats', [], { action: 'list', query: {} })
    return (
        <div>
            {(chats as IChat[]).map((c, i) => (
                <ChatEdit key={i} {...c} onSelectChat={onSelectChat} />
            ))}
        </div>
    )
}

export const Chat = (props: IChat & { onSelectChat: (chat: IChat, keyword: string) => void }) => {
    return (
        <div className="chat">
            <div className="avatar">
                <img src={props.image} />
            </div>
            <div className="info">
                <div className="title">
                    {props.name} {props.lastName ?? ''}
                </div>
                <div className="hashtags">
                    {(props.keywords ?? []).map((kw, i) => (
                        <span
                            key={i}
                            onClick={() => {
                                props.onSelectChat(props, kw)
                            }}>
                            #{kw}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    )
}

interface ISpace {
    keyword: string
    description: string
}

export const ChatEdit = (props: IChat & { onSelectChat: (chat: IChat, keyword: string) => void }) => {
    const [spaces, setSpaces] = useState<ISpace[]>(props.spaces ?? [])
    const [icon, setIconW] = useState(props.icon)
    const saveSpaces = (newSpaces: ISpace[], icon: string | undefined = undefined) => {
        apiPOST('/api/chats', fillDefined({ action: 'saveSpaces', spaces: newSpaces, chatId: props.chatId, icon }))
    }
    const setIcon = (iconSvg: string) => {
        console.log(iconSvg)
        setIconW(iconSvg)
        saveSpaces(spaces, iconSvg)
    }
    return (
        <div>
            <Chat {...props} />
            <SectionToggle className="section-chat-edit" title="Ценности" isOpened={false}>
                {spaces.map((space, i) => (
                    <ChatSpace
                        key={i}
                        {...space}
                        onSave={(newSpace) => {
                            const newSpaces = spaces.map((s, j) => (i === j ? newSpace : s))

                            saveSpaces(newSpaces)
                            setSpaces(newSpaces)
                        }}
                    />
                ))}
                <div>
                    <a
                        onClick={() => {
                                setSpaces([...spaces, { keyword: '', description: '' }])
                        }}>
                        добавить ценность
                    </a>
                </div>
            </SectionToggle>

            <SectionToggle className="section-chat-edit" title="Начисление баллов" isOpened={false}>
                <IconPicker icon={icon} cta="Выбрать символ для баллов" setIcon={setIcon} />
            </SectionToggle>
        </div>
    )
}

interface IChatSpaceProps {
    keyword?: string
    description?: string
    onSave: (space: { keyword: string; description: string }) => void
}

const ChatSpace = ({ keyword: keywordInit, description: descriptionInit, onSave }: IChatSpaceProps) => {
    const [edit, setEdit] = useState(false || !keywordInit)
    const [keyword, setKeyword] = useState(keywordInit)
    const [description, setDescription] = useState(descriptionInit)
    return (
        <div>
            {!edit && (
                <div onClick={() => setEdit(true)}>
                    #{keyword} - {description}
                </div>
            )}
            {edit && (
                <div>
                    #<input {...etv(keyword, setKeyword)} />
                    <input {...etv(description, setDescription)} />
                    <button
                        onClick={() => {
                            setEdit(false)
                            onSave({ keyword: keyword ?? '', description: description ?? '' })
                        }}>
                        Сохранить
                    </button>
                </div>
            )}
        </div>
    )
}
