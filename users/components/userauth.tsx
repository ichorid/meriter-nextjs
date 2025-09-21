import { A, P, PanelBottom, PanelScreen } from 'frontend/simple/simple-elements'
import { ReactElement, useEffect, useState } from 'react'
import PhoneInput from 'react-phone-input-2'
import { apiGET, apiPOST, swr } from 'utils/fetch'
import { etv } from 'utils/input'
import { AskConnectMessengers, EmailLogin } from './usersubscribe'

const reachGoal = (goal) => {
    try {
        ;(window as any).ym(69333628, 'reachGoal', goal)
    } catch (e) {
        console.log
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

export const UserAuth = ({ scope, onClose, successMessage, ctaConnectMessengers, telegram, onSuccess }) => {
    const [user, mutateUser] = swr('/api/user/getme?scope=' + scope, {})
    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')
    const [phone, setPhone] = useState('')
    const [email, setEmail] = useState('')
    const [hasuserdata, setHasuserdata] = useState(undefined)
    const [hasmessenger, setHasmessenger] = useState(undefined)
    const [success, setSuccess] = useState(false)
    const [finished, setFinished] = useState(false)
    const [error, setError] = useState('')
    const [codevalid, setCodevalid] = useState(undefined)
    const [codemessage, setCodemessage] = useState('')
    const [checkId, setCheckId] = useState(undefined)
    const finishInput = () => {
        if (firstName && lastName && phone && phone.length > 4) {
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
                sendcode(email)
            } else {
                setHasuserdata(false)
            }
        })
    }
    const sendcode = (email) => {
        apiGET('/api/user/sendcode', { email, scope }).then((d) => {
            if (d.checkId) {
                setCheckId(d.checkId)
                if (d.telegram) {
                    setCodemessage('Код доступа был выслан в месснеджер Telegram')
                } else if (d.sms) {
                    setCodemessage('Код доступа был выслан по SMS')
                } else {
                    setCodemessage('Код доступа был выслан на электронную почту')
                }
            }
        })
    }
    const validateCode = (code) =>
        apiGET('/api/user/validatecode', { code, checkId, email, scope }).then((d) => {
            if (d.ok) {
                setCodevalid(true)
                mutateUser(d.user)
                onSuccess()
            } else {
                setCodevalid(false)
                setCodemessage('Неправильный код, попробуйте еще раз')
            }
        })

    const subscribe = () => {
        const utm = document.location.search.replace('?', '')
        apiPOST('/api/user/subscribe', { firstName, lastName, scope, phone, email, utm }).then((d) => {
            if (d.user) {
                mutateUser(d.user)
                onSuccess()
            }
            reachGoal('SUBSCRIBE')
            setSuccess(true)
        })
    }

    return (
        <PanelBottom onClose={onClose}>
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
            {hasuserdata && codevalid === undefined && (
                <PanelScreen>
                    <P>{codemessage}</P>
                    <AskCode digitsCount="5" onSubmit={validateCode} />
                </PanelScreen>
            )}
            {hasuserdata && codevalid === false && (
                <PanelScreen>
                    <P>{codemessage}</P>
                    <AskCode digitsCount="5" onSubmit={validateCode} />
                </PanelScreen>
            )}

            {!success && !user.telegram_id && (
                <PanelScreen>
                    <P>{ctaConnectMessengers ?? 'Успешная авторизация! Для удобства доступа, подключите мессенджер'}</P>
                    <AskConnectMessengers
                        telegram={telegram ?? 'seva_prem_bot'}
                        canrefuse={true}
                        onRefuse={subscribe}
                        payload={{ email, scope, firstName, lastName, phone }}
                    />
                </PanelScreen>
            )}

            <PanelScreen>
                <P>{successMessage && 'Успешная авторизация'}</P>
            </PanelScreen>
        </PanelBottom>
    )
}

const AskCode = ({ onSubmit, digitsCount }) => {
    const [code, setCode] = useState('')

    useEffect(() => {
        if (code.length == digitsCount) {
            onSubmit(code)
            setCode('')
        }
    }, [code])

    return (
        <div className="ask-code">
            <input
                autoComplete="one-time-code"
                type="text"
                className="digits"
                placeholder={''.padStart(digitsCount, '0')}
                {...etv(code, setCode)}
            />
        </div>
    )
}
