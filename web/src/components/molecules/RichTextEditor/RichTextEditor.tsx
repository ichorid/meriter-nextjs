'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, List, ListOrdered, Link as LinkIcon, Heading1, Heading2, Quote, Code } from 'lucide-react';
import { cn } from '@/lib/utils'; // Assuming this exists, or I'll use classNames

interface RichTextEditorProps {
    content: string;
    onChange: (content: string) => void;
    placeholder?: string;
    className?: string;
    editable?: boolean;
}

const MenuBar = ({ editor }: { editor: any }) => {
    if (!editor) {
        return null;
    }

    const setLink = () => {
        const previousUrl = editor.getAttributes('link').href;
        const url = window.prompt('URL', previousUrl);

        // cancelled
        if (url === null) {
            return;
        }

        // empty
        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }

        // update
        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    };

    return (
        <div className="flex flex-wrap gap-1 p-2 border-b border-base-300 bg-base-200 rounded-t-xl">
            <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                disabled={!editor.can().chain().focus().toggleBold().run()}
                className={cn(
                    "p-1.5 rounded hover:bg-base-300 transition-colors",
                    editor.isActive('bold') ? 'bg-base-300 text-brand-primary' : 'text-base-content/70'
                )}
                title="Bold"
            >
                <Bold size={18} />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                disabled={!editor.can().chain().focus().toggleItalic().run()}
                className={cn(
                    "p-1.5 rounded hover:bg-base-300 transition-colors",
                    editor.isActive('italic') ? 'bg-base-300 text-brand-primary' : 'text-base-content/70'
                )}
                title="Italic"
            >
                <Italic size={18} />
            </button>
            <div className="w-px h-6 bg-base-300 mx-1 self-center" />
            <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={cn(
                    "p-1.5 rounded hover:bg-base-300 transition-colors",
                    editor.isActive('heading', { level: 2 }) ? 'bg-base-300 text-brand-primary' : 'text-base-content/70'
                )}
                title="Heading"
            >
                <Heading1 size={18} />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={cn(
                    "p-1.5 rounded hover:bg-base-300 transition-colors",
                    editor.isActive('bulletList') ? 'bg-base-300 text-brand-primary' : 'text-base-content/70'
                )}
                title="Bullet List"
            >
                <List size={18} />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={cn(
                    "p-1.5 rounded hover:bg-base-300 transition-colors",
                    editor.isActive('orderedList') ? 'bg-base-300 text-brand-primary' : 'text-base-content/70'
                )}
                title="Ordered List"
            >
                <ListOrdered size={18} />
            </button>
            <div className="w-px h-6 bg-base-300 mx-1 self-center" />
            <button
                onClick={setLink}
                className={cn(
                    "p-1.5 rounded hover:bg-base-300 transition-colors",
                    editor.isActive('link') ? 'bg-base-300 text-brand-primary' : 'text-base-content/70'
                )}
                title="Link"
            >
                <LinkIcon size={18} />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={cn(
                    "p-1.5 rounded hover:bg-base-300 transition-colors",
                    editor.isActive('blockquote') ? 'bg-base-300 text-brand-primary' : 'text-base-content/70'
                )}
                title="Quote"
            >
                <Quote size={18} />
            </button>
        </div>
    );
};

export const RichTextEditor = ({ content, onChange, placeholder, className, editable = true }: RichTextEditorProps) => {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-brand-primary underline cursor-pointer',
                },
            }),
            Placeholder.configure({
                placeholder: placeholder || 'Write something...',
                emptyEditorClass: 'is-editor-empty before:content-[attr(data-placeholder)] before:text-base-content/50 before:float-left before:pointer-events-none',
            }),
        ],
        content,
        editable,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: 'prose prose-sm sm:prose-base dark:prose-invert text-base-content focus:outline-none min-h-[150px] p-4 max-w-none',
            },
        },
    });

    return (
        <div className={cn("border border-base-300 rounded-xl overflow-hidden bg-base-100 focus-within:ring-2 focus-within:ring-brand-primary/20 transition-shadow", className)}>
            {editable && <MenuBar editor={editor} />}
            <EditorContent editor={editor} />
        </div>
    );
};
