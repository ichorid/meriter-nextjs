import { ChatMessage, IChatMessage } from 'bots/chatmessages/chatmessage.model'
import { mongooseTypes } from 'utils/mongooseconnect'

export async function createChatMessage(chatMessage: IChatMessage) {
  const _id = new mongooseTypes.ObjectId()
  await (ChatMessage as any).create({ _id, ...chatMessage })
  return _id
}
