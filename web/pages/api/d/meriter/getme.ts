import { getAuth } from 'projects/meriter/utils/auth'

export default async (req, res) => {
    const user = await getAuth(req, res)
    res.json({ ...(user || {}) })
}
