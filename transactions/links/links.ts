import uid from 'uid'
import shortid from 'shortid'
import { Link } from './link.model'

export async function linkSet(payload, ttlSecondsInit) {
    const ttlSeconds = ttlSecondsInit ? ttlSecondsInit : 1000 * 60 * 60 * 24 * 365 * 10
    const short_id = shortid()
    const long_id = uid(32)
    const expires = Date.now() + ttlSeconds * 1000;
    console.log('before link create')
    await Link.create({ short_id, long_id, payload, expires })
    return { short_id, long_id, payload, expires }
}

export async function linkResolveShort(short_id) {
    return (await Link.findOne({ short_id, expires: { $gte: Date.now() } }))?.payload
}

export async function linkResolveLong(long_id) {
    return (await Link.findOne({ long_id, expires: { $gte: Date.now() } }))?.payload
}
export async function linkFindOne(query) {
    return await Link.findOne(query)
}

export async function linkStatsAddClickByShortId(short_id) {
    return await Link.updateOne({ short_id }, { short_id, $inc: { 'stats.clicks': 1 } as any }, { upsert: true })
}
