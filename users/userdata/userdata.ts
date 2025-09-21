import uid from 'uid'
import { UserAccess } from 'users/useraccess/useraccess.model'
import { usertagsSetTag } from 'users/usertags/usertags.handler'
import { fillDefinedAndNotEmpty } from 'utils/object'
import { Userdata } from './userdata.model'
import { IUserdata } from './userdata.type'

export async function userdataGetByTelegramId(telegramUserId: string) {
    //return await Userdata.find({})
    const userdata: IUserdata = await Userdata.findOne({ telegramUserId: String(telegramUserId) })
    if (!userdata) return null
    const { firstName, lastName, avatarUrl, photoUrl } = userdata
    return { firstName, lastName, avatarUrl, photoUrl }
}

export async function userdataUpdateFromTelegramWebook(body: object) { }

