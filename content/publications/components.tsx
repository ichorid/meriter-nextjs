import { apiPOST } from 'projects/meriter/utils/fetch'
import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import useDebounce from 'utils/debounce'
import { swr } from 'utils/swr'
import { IPublicationElement } from './publication.type'

import { mdToDraftjs, draftjsToMd } from 'draftjs-md-converter'
import { EditorState, convertToRaw, convertFromRaw, RichUtils } from 'draft-js'
import createMarkdownShortcutsPlugin from 'draft-js-markdown-shortcuts-plugin'
import Editor from '@draft-js-plugins/editor'
import 'draft-js/dist/Draft.css'

const plugins = [createMarkdownShortcutsPlugin()]


const PublicationElement = ({ content, _id: initial_Id, edit }: IPublicationElement & { edit: boolean }) => {
    const initState = useMemo(() => {
        const rawData = mdToDraftjs(content?.md ?? '')
        const contentState = convertFromRaw(rawData)
        return () => EditorState.createWithContent(contentState)
    }, [])
    const [mode, setMode] = useState(edit ? 'edit' : 'view')

    const [_id, set_Id] = useState(initial_Id)
    const [editorState, setEditorState] = useState(initState)

    const getMarkdown = () => {
        const content = editorState.getCurrentContent()
        return draftjsToMd(convertToRaw(content))
    }

    const es = useDebounce(editorState.getCurrentContent(), 200, true)

    const [saving, setSaving] = useState(undefined)
    useEffect(() => {
        if (saving === true) return

        setSaving(true)

        apiPOST('/api/publication/update', { _id, content: { md: getMarkdown() } }).then((d) => {
            if (d._id) set_Id(d._id)
            setSaving(false)
            setTimeout(() => {
                setSaving(undefined)
            }, 2000)
        })
    }, [es])

    if (mode === 'view')
        return (
            <div
                className="publication-element"
                onDoubleClick={() => {
                    setMode('edit')
                }}>
                <div className="publication-description">
                    <ReactMarkdown children={content?.md} />
                </div>
            </div>
        )

    if (mode === 'edit')
        return (
            <div className="publication-element edit">
                <Editor editorState={editorState} onChange={setEditorState} plugins={plugins} />

                {saving === true ? (
                    <div className="saving">Сохраняю...</div>
                ) : saving === false ? (
                    <div className="saving">'Сохранено!'</div>
                ) : null}
            </div>
        )
}

export const PublicationsEditor = () => {
    const [publications, mutate] = swr('/api/publication/list', [], { key: 'publications' })
    const [editIdx, setEditIdx] = useState(undefined)
    if (editIdx !== undefined)
        return (
            <div className="publications-editor">
                <div
                    className="back-button clickable"
                    onClick={() => {
                        setEditIdx(undefined)
                        mutate([])
                    }}>
                    назад
                </div>
                <PublicationElement {...publications[editIdx]} edit={true} />
            </div>
        )

    return (
        <div className="publications-editor">
            <div
                className="add-new clickable"
                onClick={() => {
                    mutate([{ content: {} }, ...publications], false)
                    setEditIdx(0)
                }}>
                + Добавить публикацию
            </div>
            <div className="publications">
                {publications.map((p, i) => (
                    <div
                        key={p._id || 'new'}
                        onClick={() => {
                            setEditIdx(i)
                        }}>
                        <PublicationElement {...p} />
                    </div>
                ))}
            </div>
        </div>
    )
}
