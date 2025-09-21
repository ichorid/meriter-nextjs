import { mongooseConnect, mongooseSchema } from "../../utils/mongooseconnect";

const connection = mongooseConnect("meriterra/mcs/neptune/test");

export const Chat =
    connection.models.Chat ||
    connection.model(
        "Chat",
        new mongooseSchema({
            messenger: String,
            chatId:String,
            botName: String,
            isGroup: Boolean,
            keywords: [String],
            name: String,
            lastName: String,
            description: String,
            image: String,
            admins:[String],
            spaces:[
                {
                    keyword: String,
                    description:String
                }
            ],
            icon:String,
        })
    );

export interface IChat{
    messenger: string,
    chatId:string,
    botName: string,
    isGroup: boolean,
    keywords: string[],
    name: string,
    lastName: string,
    description: string,
    image: string,
    admins:string[],
    spaces:[
        {
            keyword: string,
            description:string
        }
    ],
    icon:string,
}