'use client';

import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import type { Editor } from '@tiptap/core';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Underline as UnderlineIcon,
} from 'lucide-react';
import { RichTextToolbarButton, RichTextToolbarDivider } from './RichTextToolbarButton';
import { uploadFile, useUploadImage } from '@/hooks/api/useUploads';
import type { RichTextToolbarVariant } from './types';

interface FormatToolbarProps {
  editor: Editor | null;
  variant: RichTextToolbarVariant;
  disabled?: boolean;
}

export function FormatToolbar({ editor, variant, disabled }: FormatToolbarProps) {
  const t = useTranslations('profile');
  const uploadMutation = useUploadImage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!editor || variant === 'none') {
    return null;
  }

  const showMinimal = variant === 'minimal';

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('URL', previousUrl ?? '');

    if (url === null) {
      return;
    }
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const onImagePick = async (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) {
      return;
    }
    try {
      const url = await uploadFile(file, uploadMutation, {
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.85,
      });
      editor.chain().focus().setImage({ src: url }).run();
    } catch {
      // Upload errors surface via mutation / global handlers
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 border-b border-base-300 bg-base-200">
      <RichTextToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={disabled || !editor.can().chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        title={t('richTextBold')}
      >
        <Bold size={18} />
      </RichTextToolbarButton>
      <RichTextToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={disabled || !editor.can().chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        title={t('richTextItalic')}
      >
        <Italic size={18} />
      </RichTextToolbarButton>
      <RichTextToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        disabled={disabled}
        active={editor.isActive('underline')}
        title={t('richTextUnderline')}
      >
        <UnderlineIcon size={18} />
      </RichTextToolbarButton>

      {!showMinimal ? (
        <>
          <RichTextToolbarDivider />
          <RichTextToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            disabled={disabled}
            active={editor.isActive('heading', { level: 2 })}
            title={t('richTextHeading2')}
          >
            <Heading2 size={18} />
          </RichTextToolbarButton>
          <RichTextToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            disabled={disabled}
            active={editor.isActive('heading', { level: 3 })}
            title={t('richTextHeading3')}
          >
            <Heading3 size={18} />
          </RichTextToolbarButton>
          <RichTextToolbarDivider />
          <RichTextToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            disabled={disabled}
            active={editor.isActive('bulletList')}
            title={t('bulletList')}
          >
            <List size={18} />
          </RichTextToolbarButton>
          <RichTextToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            disabled={disabled}
            active={editor.isActive('orderedList')}
            title={t('orderedList')}
          >
            <ListOrdered size={18} />
          </RichTextToolbarButton>
          <RichTextToolbarDivider />
          <RichTextToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            disabled={disabled}
            active={editor.isActive({ textAlign: 'left' })}
            title={t('richTextAlignLeft')}
          >
            <AlignLeft size={18} />
          </RichTextToolbarButton>
          <RichTextToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            disabled={disabled}
            active={editor.isActive({ textAlign: 'center' })}
            title={t('richTextAlignCenter')}
          >
            <AlignCenter size={18} />
          </RichTextToolbarButton>
          <RichTextToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            disabled={disabled}
            active={editor.isActive({ textAlign: 'right' })}
            title={t('richTextAlignRight')}
          >
            <AlignRight size={18} />
          </RichTextToolbarButton>
          <RichTextToolbarDivider />
          <RichTextToolbarButton
            onClick={setLink}
            disabled={disabled}
            active={editor.isActive('link')}
            title={t('richTextLink')}
          >
            <LinkIcon size={18} />
          </RichTextToolbarButton>
          <RichTextToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            disabled={disabled}
            active={editor.isActive('blockquote')}
            title={t('richTextQuote')}
          >
            <Quote size={18} />
          </RichTextToolbarButton>
          <RichTextToolbarButton
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || uploadMutation.isPending}
            title={t('richTextImage')}
          >
            <ImagePlus size={18} />
          </RichTextToolbarButton>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              void onImagePick(file);
              e.target.value = '';
            }}
          />
        </>
      ) : null}
    </div>
  );
}
