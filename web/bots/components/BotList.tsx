import { useState } from 'react'
import { etv } from 'utils/input'
import { telegramSetWebook } from '../telegram/telegramapi'
import { BOT_TOKEN, BOT_USERNAME } from 'projects/meriter/config'

export const BotList = () => {
    const [baseUrl, setBaseUrl] = useState('https://')
    const [botName, setBotName] = useState('@' + BOT_USERNAME)
    const [success, setSuccess] = useState(undefined)
    const wh = `${baseUrl}/api/webhooks/telegram?bot=${botName}`
    const doSetWH = () => {
        if (wh && BOT_TOKEN) {
            telegramSetWebook(BOT_TOKEN, wh)
                .then((d) => d.data)
                .then((d) => setSuccess(true))
                .catch((e) => setSuccess(false))
        }
    }
    return (
        <div>
            <div>{wh}</div>
            <div>
                <input {...etv(baseUrl, setBaseUrl)} style={{ width: '500px' }} />
            </div>
            <div>
                <input {...etv(botName, setBotName)} style={{ width: '500px' }} />
            </div>
            {success === true && <div>Успешно</div>}
            {success === false && <div>Ошибка</div>}
            <div>
                <button onClick={() => doSetWH()}>Set Webhook for @{BOT_USERNAME}</button>
            </div>
        </div>
    )
}
