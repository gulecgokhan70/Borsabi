'use client';
import React from 'react';
import Markdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const pages = new Set(['/academy', '/backtest', '/portfolio', '/piyasalar', '/screening', '/risk-center', '/trade-log', '/watchlist', '/strategy-builder']);
function pageLinks(children: React.ReactNode): React.ReactNode {
  return React.Children.map(children, child => typeof child === 'string'
    ? child.split(/(\/[a-z]+(?:-[a-z]+)*)/g).map((part, index) => pages.has(part)
      ? <a key={index} href={part} className="text-blue-500 underline">{part}</a> : part)
    : child);
}
export function AIMarkdown({ content }: { content: string }) {
  return <div className="min-w-0 max-w-full text-sm leading-relaxed break-words space-y-3">
    <Markdown remarkPlugins={[remarkGfm]} skipHtml disallowedElements={['img']}
      urlTransform={url => /^(https?:\/\/|\/(?!\/)|#)/i.test(url) ? defaultUrlTransform(url) : ''}
      components={{
        h1: ({ children }) => <h3 className="text-lg font-bold mt-4">{children}</h3>,
        h2: ({ children }) => <h3 className="text-base font-bold mt-4">{children}</h3>,
        h3: ({ children }) => <h4 className="font-semibold mt-3">{children}</h4>,
        p: ({ children }) => <p>{pageLinks(children)}</p>,
        ul: ({ children }) => <ul className="list-disc pl-5 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1">{children}</ol>,
        li: ({ children }) => <li>{pageLinks(children)}</li>,
        a: ({ href, children }) => href ? <a href={href} className="text-blue-500 underline" target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">{children}</a> : <span>{children}</span>,
        table: ({ children }) => <div className="max-w-full overflow-x-auto" tabIndex={0} role="region" aria-label="Yanıt tablosu"><table className="w-full border-collapse text-xs">{children}</table></div>,
        th: ({ children }) => <th className="border border-foreground/15 p-2 text-left">{children}</th>,
        td: ({ children }) => <td className="border border-foreground/15 p-2 align-top">{children}</td>,
        pre: ({ children }) => <pre className="max-w-full overflow-x-auto rounded-lg glass-inner p-3">{children}</pre>,
        code: ({ children }) => pages.has(String(children)) ? <a href={String(children)} className="text-blue-500 underline">{children}</a> : <code className="font-mono text-xs">{children}</code>,
      }}>{content}</Markdown>
  </div>;
}
