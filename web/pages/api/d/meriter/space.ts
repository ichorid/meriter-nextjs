import { Space } from 'projects/meriter/schema/index.schema'
import { dimensionConfigExample } from 'projects/meriter/schema/types'

export default async (req, res) => {
    const spaceSlug = req.query.spaceSlug
    if (!spaceSlug) return res.json({})

    const space = await (Space as any).findOne({ slug: spaceSlug })

    res.json({ space:{...space.toObject(),dimensionsConfig:dimensionConfigExample} })
}
