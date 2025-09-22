import { ChatMessage, IChatMessage } from 'bots/chatmessages/chatmessage.model'
import { mongooseTypes } from 'utils/mongooseconnect'
import { Model } from 'mongoose'

export async function createChatMessage(chatMessage: IChatMessage) {
  const newDoc = await (ChatMessage as Model<IChatMessage>).create(chatMessage)
  return newDoc._id
}
