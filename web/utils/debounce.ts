import React, { useState, useEffect } from 'react'

// Наш хук

export const useDebounceSet = (setter, initialValue) => {
    const [param, debounceParam] = useState(initialValue)

    const debounced = useDebounce(param, 1000, false)

    const [first, setFirst] = useState(true)
    useEffect(() => {
        if (!first) {
            setter(debounced)
        } else setFirst(false)
    }, [debounced])

    return [param, debounceParam]
}

export default function useDebounce(value, delay, preventFirst = true) {
    // Состояние и сеттер для отложенного значения
    const [debouncedValue, setDebouncedValue] = useState(value)
    const [first, setFirst] = useState(preventFirst)

    useEffect(
        () => {
            // Выставить debouncedValue равным value (переданное значение)
            // после заданной задержки
            const handler =
                !first &&
                setTimeout(() => {
                    setDebouncedValue(value)
                }, delay)

            setFirst(false)

            // Вернуть функцию очистки, которая будет вызываться каждый раз, когда ...
            // ... useEffect вызван снова. useEffect будет вызван снова, только если ...
            // ... value будет изменено (смотри ниже массив зависимостей).
            // Так мы избегаем изменений debouncedValue, если значение value ...
            // ... поменялось в рамках интервала задержки.
            // Таймаут очищается и стартует снова.
            // Что бы сложить это воедино: если пользователь печатает что-то внутри ...
            // ... нашего приложения в поле поиска, мы не хотим, чтобы debouncedValue...
            // ... не менялось до тех пор, пока он не прекратит печатать дольше, чем 500ms.
            return () => {
                !first ? clearTimeout(handler) : () => {}
            }
        },
        // Вызывается снова, только если значение изменится
        // мы так же можем добавить переменную "delay" в массива зависимостей ...
        // ... если вы собираетесь менять ее динамически.
        [value]
    )

    return debouncedValue
}

export const useEffect2 = (fn, init) => {
    const [first, setFirst] = useState(true)

    return useEffect(() => {
        if (!first) return fn()
        else {
            setFirst(false)
            return () => {}
        }
    }, init)
}
