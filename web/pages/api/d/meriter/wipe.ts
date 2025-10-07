import {
    Transaction,
    SentTGMessageLog,
    TgChat,
    Capitalization,
    User,
    Publication,
    Space,
    Wallet,
} from 'projects/meriter/schema/index.schema'
import { initMeriterra } from 'projects/meriter/actions/community'

export default async (req, res) => {
    if (process.env.NODE_ENV !== 'development') return res.json({})
    await SentTGMessageLog.deleteMany({})
    await User.deleteMany({})
    await Publication.deleteMany({})
    await Space.deleteMany({})
    await Transaction.deleteMany({})
    await TgChat.deleteMany({})
    await Capitalization.deleteMany({})
    await Wallet.deleteMany({})
    await initMeriterra()

    res.json({})
}
