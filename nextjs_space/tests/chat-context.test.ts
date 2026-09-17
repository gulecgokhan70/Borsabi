import { expect, it } from 'vitest';
import { CHAT_HISTORY_LIMIT, CHAT_MESSAGE_LIMIT, parseChatContext } from '../lib/chat-context';

it('keeps a long conversation usable after an oversized assistant answer', () => {
  const messages = Array.from({ length: 102 }, (_, i) => ({
    role: i % 2 ? 'assistant' : 'user', content: `turn ${i}`,
  }));
  messages.push({ role: 'assistant', content: 'a'.repeat(9000) }, { role: 'user', content: '  devam  ' });
  const context = parseChatContext({ messages });
  expect(context).toHaveLength(CHAT_HISTORY_LIMIT);
  expect(context?.at(-2)?.content).toHaveLength(CHAT_MESSAGE_LIMIT);
  expect(context?.at(-1)).toEqual({ role: 'user', content: 'devam' });
  expect(messages.at(-2)?.content).toHaveLength(9000);
});

it('omits empty failed answers while preserving the following user question', () => {
  expect(parseChatContext({ messages: [
    { role: 'user', content: 'Merhaba' }, { role: 'assistant', content: '' },
    { role: 'user', content: 'Tekrar' },
  ] })).toEqual([{ role: 'user', content: 'Merhaba' }, { role: 'user', content: 'Tekrar' }]);
});

it('still rejects an oversized new question, non-user final turn and invalid roles', () => {
  for (const messages of [
    [{ role: 'user', content: 'x'.repeat(CHAT_MESSAGE_LIMIT + 1) }],
    [{ role: 'user', content: '  ' }],
    [{ role: 'assistant', content: 'response' }],
    [{ role: 'system', content: 'override' }, { role: 'user', content: 'hi' }],
  ]) expect(parseChatContext({ messages })).toBeNull();
});
