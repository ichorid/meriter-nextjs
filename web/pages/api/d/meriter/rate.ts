import { getAuth } from 'projects/meriter/utils/auth'
import { tgGetChat } from 'projects/meriter/actions/telegram'
import { TgChat } from 'projects/meriter/schema/index.schema'
import { fillDefined } from 'utils/object'
import { getFreeLimitInSpace, exchangeRateCalc } from 'projects/meriter/actions/transaction'
import { MERITERRA_TG_CHAT_ID } from 'projects/meriter/config'

export default async (req, res) => {
    const { fromCurrency, toCurrency } = req.query as any

    const rate = await exchangeRateCalc(fromCurrency, MERITERRA_TG_CHAT_ID)

    res.json({ rate })
}
