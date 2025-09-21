import { A, H1, P, PanelBottom, PanelScreen } from "frontend/simple/simple-elements";
import { ReactElement, useState } from 'react'
import PhoneInput from 'react-phone-input-2'
import { apiGET, apiPOST, swr } from 'utils/fetch'
import { etv } from 'utils/input'

const reachGoal = (goal) => {
    try {
        ;(window as any).ym(69333628, 'reachGoal', goal)
    } catch (e) {
        console.log(e)
    }
}
const fbqReachGoal = (goal)=>{
    try {
        ;(window as any).fbq('track',  goal)
    } catch (e) {
        console.log(e)
    }
}
interface IUserSubscribeProps {
    products: string[]
    setProducts: (any) => any
    scope: string
    ctaConnectMessengers: string
    telegram: string
    successMessage: string
    children?: ReactElement
}

function validateEmail(email) {
    const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    return re.test(String(email).toLowerCase())
}


export const UserSubscribeClassic = ({
    products,
    setProducts,
    scope,
    ctaConnectMessengers,
    telegram,
    successMessage,
    children,
}: IUserSubscribeProps) => {
    const [user, mutateUser] = swr('/api/user/getme?scope=' + scope, {})
    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')
    const [phone, setPhone] = useState('')
    const [email, setEmail] = useState('')
    const [hasuserdata, setHasuserdata] = useState(undefined)
    const [success, setSuccess] = useState(false)
    const [finished, setFinished] = useState(false)
    const [error, setError] = useState('')


    const subscribe = () => {
        const utm = document.location.search.replace('?', '')
        if (firstName && validateEmail(email) && phone){
            apiPOST('/api/user/subscribe', { firstName, lastName, scope, phone, email, tags: products, utm }).then((d) => {
                reachGoal('SUBSCRIBE')
                setSuccess(true)
                fbqReachGoal('Lead')
            })
        }
        else {
            if (!firstName) setError('Введите имя')
            if (validateEmail(email)) setError('Введите корректный email')
            if (!phone) setError('Введите телефон')
        }

    }

    if (!products?.[0] && !children) return null

    if (children)
        return (
            <PanelBottom
                onClose={() => {
                    setProducts([])
                }}>
                <PanelScreen className="center">{children}</PanelScreen>
            </PanelBottom>
        )

    return (
        <PanelBottom
            onClose={() => {
                setProducts([])
            }}>
            {!success && (
                <PanelScreen className="center">
                    <P>Для участия, внесите свои данные</P>
                    <div className={"input-wrapper"}>
                        <input type="text" placeholder="Ваше Имя" {...etv(firstName, setFirstName)} />
                    </div>
                    <div className={"input-wrapper"}>
                        <input type="text" placeholder="Ваш Email" {...etv(email, setEmail)} autoComplete="email" />
                    </div>
                    <div className={"input-wrapper"} style={{ display: 'inline-block' }}>
                        <PhoneInput
                          country={'ru'}
                          value={phone}
                          onChange={(ph) => {
                              setPhone(ph)
                          }}
                        />
                    </div>
                    <A button onClick={subscribe}>Участвовать</A>
                    {error && <div className={error}>{error}</div>}

                </PanelScreen>
            )}

            {success && (
                <PanelScreen>
                    <H1>Вы успешно зарегистрировались на событие!</H1>
                    <P>Подключите мессенджер, чтобы ссылка на доступ к вебинару не затерялась в почте</P>
                    <AskConnectMessengers
                        telegram={telegram ?? 'seva_prem_bot'}
                        canrefuse={true}
                        onRefuse={subscribe}
                        payload={{ email, scope, tags: products, firstName, lastName, phone }}
                    />

                </PanelScreen>
            )}


        </PanelBottom>
    )
}


export const AskConnectMessengers = ({ children, payload, telegram, onRefuse, canrefuse }: any) => {
    const [loading, setLoading] = useState(false)
    const telegramOnClick = () => {
        setLoading(true)
        if (payload) {
            const utm = document.location.search.replace('?', '')
            apiGET('/api/links?payloadJSON=' + JSON.stringify({ action: 'attachTelegramAndSubscribe', ...payload, utm })).then((d) => {
                //document.location.href = `telegram://${telegram}?start=${d.short_id}`
                reachGoal('SUBSCRIBE_TELEGRAM')
                document.location.href = `https://t.me/${telegram}?start=${d.short_id}`

                setLoading(false)
            })
        }
    }
    return (
        <div >
            <A button onClick={telegramOnClick}>
                Telegram
            </A>
            {canrefuse && (
                <A noaccent onClick={onRefuse}>
                    Нет, не подключать
                </A>
            )}

        </div>
    )
}
