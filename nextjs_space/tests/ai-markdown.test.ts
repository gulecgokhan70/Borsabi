import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { AIMarkdown } from '@/components/ai-markdown';

it('renders headings, GFM tables and known internal page paths', () => {
  const html = renderToStaticMarkup(React.createElement(AIMarkdown, { content: '### RSI\n\n**Bilgi** için /academy\n\n| A | B |\n| --- | --- |\n| 1 | 2 |' }));
  expect(html).toContain('<h4');
  expect(html).toContain('<strong>Bilgi</strong>');
  expect(html).toContain('href="/academy"');
  expect(html).toContain('<table');
  expect(html).toContain('overflow-x-auto');
});
it('does not execute raw HTML, unsafe links or external image trackers', () => {
  const html = renderToStaticMarkup(React.createElement(AIMarkdown, { content: '<script>alert(1)</script>\n\n[x](javascript:alert%281%29)\n\n![tracker](https://example.com/a.png)' }));
  expect(html).not.toContain('<script');
  expect(html).not.toContain('href="javascript:');
  expect(html).not.toContain('<img');
});
