export interface ISendqueue {
    uid: string
    proto: string
    subject: string
    text: string
    messenger: string
    recieverId: string
    fromId: string
    fromName: string
    isSent?: string
    status?: string
    onTime: number
    sentTime?: string
    isRead?: string
    reason?: string
}
