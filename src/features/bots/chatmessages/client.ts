import { useApiGET } from 'utils/fetch'

export const useChatMessages = (chatId: string, hashtag: string, postId: string) => {
    const [messages] = useApiGET('/api/chatmessages', [], { chatId, hashtag, postId })
    return [messages]
}
