export interface IUserdata {
    telegramUserId?: string
    telegramUsername?: string
    token?: string
    phone?: string
    email?: string

    source?: string
    scope?: string
    //data_fields
    avatarUrl?: string
    photoUrl?: string
    firstName?: string
    lastName?: string

    payload?: any
    ts?: number
}
