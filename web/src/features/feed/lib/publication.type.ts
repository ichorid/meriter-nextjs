export interface IPublicationElement {
    _id?: string
    type?: string
    uri: string
    url?: string
    proto?: string
    meta?: object
    content?: any
    tags?: string[]
    ts?: number
}

export interface IPollData {
    title: string
    description?: string
    options: IPollOption[]
    expiresAt: Date | string
    createdAt: Date | string
    totalVotes: number
    communityId: string
}

export interface IPollOption {
    id: string
    text: string
    votes: number // total score allocated
    voterCount: number
}

export interface IPollVote {
    optionId: string
    amount: number
    votedAt: Date | string
}
