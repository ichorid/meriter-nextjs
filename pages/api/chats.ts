import { handlerChats } from "bots/chats/handler"

export default async (req, res) => {
    return await handlerChats(req, res);
}