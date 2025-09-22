import uid from "uid";
import { mongooseConnect, mongooseSchema } from "../../utils/mongooseconnect";

const connection = mongooseConnect("meriterra/mcs/neptune/meriterra");

//console.log(connection);
export const LegacyUserdata =
    connection?.models?.Userdata ||
    connection?.model(
        "Userdata",
        new mongooseSchema({
            //identies
            telegramUserId: String,
            telegramUsername: String,
            token: String,
            phone: String,
            email: String,

            source: String,
            scope: String,
            //data_fields
            avatarUrl: String,
            photoUrl: String,
            firstName: String,
            lastName: String,
        })
    );

//token is id
export const LegacyUsers =
    connection?.models?.Users ||
    connection?.model(
        "Users",
        new mongooseSchema({
            phone: { type: String, index: true },
            email: { type: String, index: true },
            token: {
                type: String,
                index: true,
                default: function () {
                    return uid(32);
                },
            },
            tgUsername: String,
            vkUserID: String,
            viberID: String,
            referal: String,
            created: Date,
        })
    );
export interface iUser {
    _id?: string;
    phone?: string;
    email?: string;
    tgUsername?: string;
    vkUserID?: string;
    viberID?: string;
    referal?: string;
    created?: Date;
}

export const LegacyChannels =
    connection?.models?.Channels ||
    connection?.model(
        "Channels",
        new mongooseSchema({
            token: { type: String, index: true },
            messenger: { type: String, enum: ["tg,vk,vb,email"] },
            project: String,
            telegramBotName: String,
            telegramUserName: String,
            telegramChatID: String,
            viberBotName: String,
            viberChatID: String,
            vkGroupID: String,
            vkChatID: String,
            vkUserID: String,
            vkBotName: String,
            firstName: String,
            lastName: String,
            avatar: [String],
            preferable: Boolean,
        })
    );

export const LegacyUserProfiles =
    connection?.models?.Users ||
    connection?.model(
        "UserProfiles",
        new mongooseSchema({
            token: { type: String, index: true },
            project: String,
            firstName: String,
            lastName: String,
            email: String,
            avatars: [String],
        })
    );
export interface IUserProfileLegacy {
    token: string;
    project: string;
    firstName: string;
    lastName?: string;
    avatars?: string[];
}
