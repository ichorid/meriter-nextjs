import { NextApiRequest, NextApiResponse } from 'next'
import { LegacyChannels, LegacyUserdata, LegacyUserProfiles, LegacyUsers } from './legacy.model'

export const legacyHandler = async (req: NextApiRequest, res: NextApiResponse) => {
    const userdata = await (LegacyUserdata as any).find({ telegramUserId: { $exists: true } })

    return res.json({ userdata })
}
