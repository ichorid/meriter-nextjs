import { A, P, PanelBottom, PanelScreen } from 'frontend/simple/simple-elements'
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
interface IUserSubscribeProps {
    products: string[]
    setProducts: (any) => any
    scope: string
    ctaConnectMessengers: string
    telegram: string
    successMessage: string
    children?: ReactElement
}

export const UserSubscribe = ({
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
    const finishInput = () => {
        if (firstName && lastName && phone) {
            setFinished(true)
            reachGoal('INPUT_DATA')
            setError('')
        } else {
            if (!firstName) setError('Введите имя')
            if (!lastName) setError('Введите фамилию или псевдоним')
            if (!phone) setError('Введите телефон')
        }
    }

    const hasnameonscope = (email) => {
        reachGoal('EMAIL_INPUT')
        apiGET('/api/user/hasnameonscope', { email, scope }).then((d) => {
            if (d.count > 0) {
                setHasuserdata(true)
                reachGoal('FOUND_DATA')
            } else {
                setHasuserdata(false)
            }
        })
    }
    const validateCode = (code) =>
        apiGET('/api/useraccess', { action: 'validatecode', code, checkId: user.checkId, scope }).then((d) => {
            if (d.acceessGranted) {
                mutateUser(d)
            }
        })

    const subscribe = () => {
        const utm = document.location.search.replace('?', '')
        apiPOST('/api/user/subscribe', { firstName, lastName, scope, phone, email, tags: products, utm }).then((d) => {
            reachGoal('SUBSCRIBE')
            setSuccess(true)
        })
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
            {hasuserdata === undefined && (
                <PanelScreen className="center">
                    <P>Введите email, чтобы продолжить</P>
                    <EmailLogin
                        placeholder="you@mail.ru"
                        email={email}
                        setEmail={setEmail}
                        button={'Продолжить'}
                        onSubmit={hasnameonscope}
                    />
                </PanelScreen>
            )}
            {hasuserdata === false && !finished && (
                <PanelScreen className="center">
                    <P>Введите свои данные</P>
                    <div className="ask-userinfo">
                        <div>
                            <input type="text" placeholder="Имя" {...etv(firstName, setFirstName)} />
                        </div>
                        <div>
                            <input type="text" placeholder="Фамилия или псевдоним" {...etv(lastName, setLastName)} />
                        </div>
                        <div style={{ display: 'inline-block' }}>
                            <PhoneInput
                                country={'ru'}
                                value={phone}
                                onChange={(ph) => {
                                    setPhone(ph)
                                }}
                            />
                        </div>
                        <A onClick={finishInput}>Сохранить</A>
                        {error && <div className={error}>{error}</div>}
                    </div>
                </PanelScreen>
            )}
            {false && user.emailconfirm && (
                <PanelScreen>
                    <P>Введите сюда код, пришедший на электронный адрес {user.email}</P>
                    <AskCode digitsCount="5" onSubmit={validateCode} />
                </PanelScreen>
            )}
            {false && user.phoneconfirm && (
                <PanelScreen>
                    <P>Введите сюда код, пришедший на номер телефона {user.phonemasked}</P>
                    <AskCode digitsCount="5" onSubmit={validateCode} />
                </PanelScreen>
            )}
            {!success && !user.telegram_id && (
                <PanelScreen>
                    <P>{ctaConnectMessengers ?? 'Подключите мессенджер, чтобы ссылка на доступ к вебинару не потерялась'}</P>
                    <AskConnectMessengers
                        telegram={telegram ?? 'seva_prem_bot'}
                        canrefuse={true}
                        onRefuse={subscribe}
                        payload={{ email, scope, tags: products, firstName, lastName, phone }}
                    />
                </PanelScreen>
            )}

            {!success && (
                <PanelScreen>
                    <A onClick={subscribe}>Подтвердить регистрацию</A>
                </PanelScreen>
            )}

            <PanelScreen>
                <P>{successMessage && 'Регистрация прошла успешно, должно прийти сообщение'}</P>
            </PanelScreen>
        </PanelBottom>
    )
}

export const EmailLogin = ({ placeholder, button, onSubmit, email, setEmail }) => {
    function validateEmail(email) {
        const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
        return re.test(String(email).toLowerCase())
    }

    const [error, setError] = useState('')
    return (
        <div className="email-login">
            <input type="email" autoComplete="email" placeholder={placeholder} {...etv(email, setEmail)} />
            <A onClick={() => (validateEmail(email) ? onSubmit(email) : setError('введите корректный email!'))}>{button}</A>
            {error && <div>{error}</div>}
        </div>
    )
}

const AskCode = ({ onSubmit, digitsCount }) => {
    const [code, setCode] = useState('')
    code.length == digitsCount && onSubmit(code)
    return (
        <div className="ask-code">
            <input type="text" className="digits" placeholder={''.padStart(digitsCount, '0')} {...etv(code, setCode)} />
        </div>
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
        <div>
            <A button onClick={telegramOnClick}>
                Telegram
            </A>
            {canrefuse && (
                <A noaccent onClick={onRefuse}>
                    Нет, не подключатть
                </A>
            )}
        </div>
    )
}
