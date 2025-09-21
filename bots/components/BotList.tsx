import { useState } from 'react'
import { etv } from 'utils/input'
import { Bots } from '../bots.data'
import { telegramSetWebook } from '../telegram/telegramapi'

export const BotList = () => {
    const botsTelegram = Object.keys(Bots.telegram)
    const [baseUrl, setBaseUrl] = useState('https://')
    const [botName, setBotName] = useState('@meriterrabot')
    const [success, setSuccess] = useState(undefined)
    const wh = `${baseUrl}/api/webhooks/telegram?bot=${botName}`
    const doSetWH = (token, b) => {
        setBotName(b)
        if (wh && token) {
            telegramSetWebook(token, wh)
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
            {botsTelegram.map((b, i) => (
                <div key={i}>
                    <button onClick={() => setBotName(b)}>{b}</button>

                    <button onClick={() => doSetWH(Bots.telegram[b].token, b)}>Set Webhook</button>
                </div>
            ))}
        </div>
    )
}
