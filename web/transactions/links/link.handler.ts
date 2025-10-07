import { ChatMessage } from 'bots/chatmessages/chatmessage.model'
import { NextApiRequest, NextApiResponse } from 'next'
import { useEffect } from 'react'
import { fillDefined } from 'utils/object'
import { useApiGET } from 'utils/fetch'
import { linkResolveShort, linkSet } from './links'

export const handlerLinks = async (req: NextApiRequest, res: NextApiResponse) => {
    const { payloadJSON, ttl, short_id } = req.query

    if (short_id) {
        const links = await linkResolveShort(short_id)
        return res.json({ links })
    }
    if (!payloadJSON) return res.json({ error: 'no payload json' })
    const payload = JSON.parse(payloadJSON as string)
    return res.json(await linkSet(payload, ttl ?? 60 * 60 * 24 * 365 * 10))
}
