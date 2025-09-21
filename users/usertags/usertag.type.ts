export interface IUserTag {
    token: string
    tag: string
    value: boolean
    permissive?: boolean
    meta?: object
    expires: number
    timeSet: number
}
