import { Relation } from './relation.model'

export async function getRelationsTotal(findQuery, key) {
    const sum = await Relation.aggregate([{ $match: findQuery }, { $group: { _id: null, total: { $sum: '$' + key } } }])
    return sum?.[key]
}
