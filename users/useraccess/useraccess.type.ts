export interface IUserAccess {
    _id?: string
    uuid?: string
    source?: string
    token?: string
    priveleges?: string[]
    email?: string
    phone?: string
    telegram_id?: string
    vk_id?: string
    utms?: {
        utm: string
        ts: Date
    }[]
}
