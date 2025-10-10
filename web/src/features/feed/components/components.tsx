'use client';

import { apiPOST } from '@lib/fetch'
import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import useDebounce from '@lib/debounce'
import { swr } from '@lib/swr'
import { IPublicationElement } from '../types'

const PublicationElement = ({ content, _id: initial_Id, edit }: IPublicationElement & { edit: boolean }) => {
    const [mode, setMode] = useState(edit ? 'edit' : 'view')
    const [_id, set_Id] = useState(initial_Id)
    const [markdown, setMarkdown] = useState(content?.md ?? '')

    const debouncedMarkdown = useDebounce(markdown, 500, true)

    const [saving, setSaving] = useState<boolean | undefined>(undefined)
    
    useEffect(() => {
        if (!edit) return
        if (saving === true) return

        const saveContent = async () => {
            setSaving(true)
            try {
                const result = await apiPOST('/api/publication/update', { _id, content: { md: markdown } })
                if (result._id) set_Id(result._id)
                setSaving(false)
                setTimeout(() => {
                    setSaving(undefined)
                }, 2000)
            } catch (error) {
                console.error('Failed to save publication:', error)
                setSaving(false)
            }
        }
        saveContent()
    }, [debouncedMarkdown, _id, edit])

    if (mode === 'view')
        return (
            <div
                className="publication-element"
                onDoubleClick={() => {
                    setMode('edit')
                }}>
                <div className="publication-description">
                    <ReactMarkdown>{content?.md || ''}</ReactMarkdown>
                </div>
            </div>
        )

    if (mode === 'edit')
        return (
            <div className="publication-element edit">
                <textarea
                    className="markdown-editor"
                    value={markdown}
                    onChange={(e) => setMarkdown(e.target.value)}
                    placeholder="Write markdown here..."
                    rows={20}
                />
                <div className="markdown-preview">
                    <h4>Preview:</h4>
                    <ReactMarkdown>{markdown}</ReactMarkdown>
                </div>

                {saving === true ? (
                    <div className="saving">Сохраняю...</div>
                ) : saving === false ? (
                    <div className="saving">Сохранено!</div>
                ) : null}
            </div>
        )
}

export const PublicationsEditor = () => {
    const [publications, mutate] = swr('/api/publication/list', [], { key: 'publications' })
    const [editIdx, setEditIdx] = useState<number | undefined>(undefined)
    
    if (editIdx !== undefined)
        return (
            <div className="publications-editor">
                <button
                    className="back-button"
                    onClick={() => {
                        setEditIdx(undefined)
                        mutate([])
                    }}>
                    ← Назад
                </button>
                <PublicationElement {...publications[editIdx]} edit={true} />
            </div>
        )

    return (
        <div className="publications-editor">
            <button
                className="add-new"
                onClick={() => {
                    mutate([{ content: { md: '' } }, ...publications], false)
                    setEditIdx(0)
                }}>
                + Добавить публикацию
            </button>
            <div className="publications">
                {publications.map((p: IPublicationElement, i: number) => (
                    <div
                        key={p._id || `new-${i}`}
                        onClick={() => {
                            setEditIdx(i)
                        }}
                        style={{ cursor: 'pointer' }}>
                        <PublicationElement {...p} edit={false} />
                    </div>
                ))}
            </div>
        </div>
    )
}
