import { z } from 'zod';

export const CHAT_HISTORY_LIMIT = 6;
export const CHAT_MESSAGE_LIMIT = 6000;
const messageSchema = z.object({
  role: z.enum(['user', 'assistant']), content: z.string(),
});

/** Bound context, not the conversation visible to the user. */
export function parseChatContext(body: unknown) {
  const parsed = z.object({ messages: z.array(messageSchema).min(1) }).safeParse(body);
  if (!parsed.success) return null;
  const last = parsed.data.messages.at(-1)!;
  if (last.role !== 'user' || !last.content.trim() || last.content.trim().length > CHAT_MESSAGE_LIMIT) return null;
  return parsed.data.messages
    .filter(message => message.content.trim())
    .slice(-CHAT_HISTORY_LIMIT)
    .map(message => ({ role: message.role, content: message.content.trim().slice(0, CHAT_MESSAGE_LIMIT) }));
}
