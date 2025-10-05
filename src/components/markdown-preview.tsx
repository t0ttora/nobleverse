'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

export default function MarkdownPreview({ text }: { text: string }) {
  if (!text.trim())
    return <span className='text-muted-foreground'>Nothing to preview</span>;
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      components={{
        a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
          <a
            className='text-primary underline underline-offset-2 hover:opacity-90'
            target='_blank'
            rel='noreferrer'
            {...props}
          />
        ),
        p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
          <p className='mb-2 leading-relaxed whitespace-pre-wrap' {...props} />
        ),
        ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
          <ul className='mb-2 list-disc space-y-1 pl-5' {...props} />
        ),
        ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
          <ol className='mb-2 list-decimal space-y-1 pl-5' {...props} />
        ),
        li: (props: React.LiHTMLAttributes<HTMLLIElement>) => (
          <li className='leading-relaxed' {...props} />
        ),
        blockquote: (props: React.BlockquoteHTMLAttributes<HTMLElement>) => (
          <blockquote
            className='border-foreground/20 text-muted-foreground mb-2 border-l-2 pl-3 italic'
            {...props}
          />
        ),
        code: ({
          inline,
          className,
          children,
          ...props
        }: {
          inline?: boolean;
          className?: string;
          children?: React.ReactNode;
        }) => {
          const content = String(children || '');
          if (inline) {
            return (
              <code
                className={`bg-foreground/10 rounded px-1 py-0.5 text-xs ${className || ''}`}
                {...props}
              >
                {content}
              </code>
            );
          }
          return (
            <pre className='bg-muted/60 mb-2 overflow-auto rounded-md p-3'>
              <code className='text-xs leading-relaxed' {...props}>
                {content}
              </code>
            </pre>
          );
        },
        hr: (props: React.HTMLAttributes<HTMLHRElement>) => (
          <hr className='border-border my-3' {...props} />
        )
      }}
    >
      {text}
    </ReactMarkdown>
  );
}
