import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import type { Extensions } from '@tiptap/core';

export interface CreateEditorExtensionsOptions {
  placeholder?: string;
  /** Allow inline images (uploads via toolbar). Default true. */
  images?: boolean;
}

export function createEditorExtensions(options: CreateEditorExtensionsOptions = {}): Extensions {
  const { placeholder, images = true } = options;

  const extensions: Extensions = [
    StarterKit.configure({
      heading: { levels: [2, 3] },
    }),
    Underline,
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        class: 'text-brand-primary underline cursor-pointer',
        rel: 'noopener noreferrer',
        target: '_blank',
      },
    }),
    Placeholder.configure({
      placeholder: placeholder || '',
      emptyEditorClass:
        'is-editor-empty before:content-[attr(data-placeholder)] before:text-base-content/50 before:float-left before:pointer-events-none',
    }),
  ];

  if (images) {
    extensions.push(
      Image.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg my-2',
        },
      }),
    );
  }

  return extensions;
}
