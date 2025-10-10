import { useState, useEffect } from 'react'

export const useDebounceSet = <T>(setter: (value: T) => void, initialValue: T): [T, (value: T) => void] => {
    const [param, debounceParam] = useState<T>(initialValue)

    const debounced = useDebounce(param, 1000, false)

    const [first, setFirst] = useState(true)
    useEffect(() => {
        if (!first) {
            setter(debounced)
        } else setFirst(false)
    }, [debounced, first, setter])

    return [param, debounceParam]
}

export default function useDebounce<T>(value: T, delay: number, preventFirst = true): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value)
    const [first, setFirst] = useState(preventFirst)

    useEffect(
        () => {
            const handler = !first
                ? setTimeout(() => {
                      setDebouncedValue(value)
                  }, delay)
                : undefined

            setFirst(false)

            return () => {
                if (handler) {
                    clearTimeout(handler)
                }
            }
        },
        [value, delay, first]
    )

    return debouncedValue
}

export const useEffectAfterMount = (fn: () => void | (() => void), deps: React.DependencyList): void => {
    const [first, setFirst] = useState(true)

    return useEffect(() => {
        if (!first) return fn()
        else {
            setFirst(false)
            return () => {}
        }
    }, deps)
}
