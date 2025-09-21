import { P, H2, A, H1, B } from 'frontend/simple/simple-elements'
import { useState } from 'react'
import { apiGET, swr } from 'utils/fetch'
import { etv } from 'utils/input'

export const UsertagsManager = () => {
    const [tag, setTag] = useState('')
    const [phone, setPhone] = useState('')
    const [result, setResult] = useState('')
    const [users, setUsers] = useState([])
    const [token, setToken] = useState(undefined)
    const [db] = swr('/api/user/adminTagList', { usersTags: [], tagsUsers: [], users: [] })

    const byPhone = () => {
        try {
            apiGET(`/api/user/adminFindByPhone?phone=${phone}`).then((d) => {
                setUsers(d.users)
                //setResult('ok')
            })
        } catch (e) {
            const [result, setResult] = useState('')
            setResult(e.message)
        }
    }
    const setTagOnce = () => {
        try {
            if (token && tag)
                apiGET(`/api/user/adminSetUserTagOnce?tag=${tag}&token=${token}`).then((d) => {
                    setToken(undefined)
                    //setResult('ok')
                })
        } catch (e) {
            const [result, setResult] = useState('')
            setResult(e.message)
        }
    }
    return (
        <div>
            <H1>Управление тэгами</H1>
            <H2>Найти пользователей</H2>
            {users.map((u, i) => (
                <P key={i}>
                    {token === u.token ? (
                        <B>Выбрано</B>
                    ) : (
                        <A
                            inline
                            onClick={() => {
                                setToken(u.token)
                            }}>
                            Выбрать
                        </A>
                    )}{' '}
                    {u.email} {u.phone} {u.telegram_id}{' '}
                </P>
            ))}
            <div>
                <input {...etv(phone, setPhone)} />
            </div>
            <A button onClick={byPhone}>
                По номеру телефона
            </A>
            <H2>Установить для выбранного пользователя тэг</H2>
            <div>
                <input {...etv(tag, setTag)} />
            </div>
            <A button onClick={setTagOnce}>
                Установить единожды
            </A>
            {result && <P>{result}</P>}

            <H2>Тэги</H2>
            {db.tagsUsers.map((t) => (
                <P>{t.tag}</P>
            ))}
        </div>
    )
}
