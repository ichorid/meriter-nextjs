'use client';

import { useEffect, useState } from 'react'
import useDebounce from '@lib/debounce'
import { getIconsLogojoy, getIconsLogojoyProxy } from '@lib/getIcon'
import { etv } from '@shared/lib/input-utils'

export const IconPicker = ({ icon, cta, setIcon }) => {
    const [opened, setOpened] = useState(false)
    const [search, setSearch] = useState('')
    const [icons, setIcons] = useState([])
    const serachDebounced = useDebounce(search, 500, true)
    const [error, setError] = useState('')
    useEffect(() => {
        if (serachDebounced && serachDebounced.length > 1) {
            getIconsLogojoyProxy(serachDebounced, 1).then((d) => {
                if (!d.symbols || d.symbols.length == 0) {
                    setError('не найдено, попробуйте другое слово')
                } else {
                    setIcons(d.symbols)
                    setError('')
                }
            })
        }
    }, [serachDebounced])

    return (
        <div className="icon-picker">
            <div className="header">
                {icon && <img src={icon} className="icon-points" />}
                <a className="clickable" onClick={() => setOpened(true)}>
                    {cta}
                </a>
            </div>
            {opened && (
                <div>
                    <div>
                        <input placeholder="Введите слово на английском" {...etv(search, setSearch)} />
                    </div>
                    <div className="icons">
                        {icons.map((icon, i) => (
                            <div
                                key={i}
                                onClick={() => {
                                    setIcon(icon.svgUrl)
                                }}>
                                <img src={icon.preview} />
                            </div>
                        ))}
                    </div>
                    {error && <div>{error}</div>}
                </div>
            )}
        </div>
    )
}
