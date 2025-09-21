import { useApiGET } from 'utils/fetch'

export const useChatMessages = (chatId, hashtag, postId) => {
    const [messages] = useApiGET('/api/chatmessages', [], { chatId, hashtag, postId })
    return [messages]
}
