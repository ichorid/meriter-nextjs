'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const MARKDOWN_PLUGINS = [remarkGfm];

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export function MarkdownContent({ content, className = '' }: MarkdownContentProps) {
  return (
    <div className={`markdown-content ${className}`.trim()}>
      <ReactMarkdown
        remarkPlugins={MARKDOWN_PLUGINS}
        components={{
          h1: ({ children }) => (
            <h2 className="text-xl font-semibold tracking-tight mt-4 mb-2 first:mt-0 text-base-content">
              {children}
            </h2>
          ),
          h2: ({ children }) => (
            <h3 className="text-lg font-semibold tracking-tight mt-3 mb-2 first:mt-0 text-base-content">
              {children}
            </h3>
          ),
          h3: ({ children }) => (
            <h4 className="text-base font-semibold mt-2 mb-1 first:mt-0 text-base-content">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="mb-2 last:mb-0 text-base-content leading-relaxed">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-5 mb-3 space-y-1 text-base-content">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 mb-3 space-y-1 text-base-content">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-base-content">{children}</strong>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-stitch-border">
              <table className="min-w-full text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-stitch-surface2 text-left">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 font-semibold text-base-content border-b border-stitch-border">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-base-content border-b border-stitch-border/60 align-top">
              {children}
            </td>
          ),
          tr: ({ children }) => <tr className="even:bg-stitch-surface2/40">{children}</tr>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/80"
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function looksLikeHtml(content: string): boolean {
  return content.includes('<') && content.includes('>');
}
