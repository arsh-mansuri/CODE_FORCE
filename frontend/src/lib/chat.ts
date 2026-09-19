import type { ChatMessage } from '../types/connections';

// Sending and polling can return the same message in either order.
export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(current.map(message => [message.id, message]));
  incoming.forEach(message => byId.set(message.id, message));
  return [...byId.values()].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id.localeCompare(b.id));
}

// The cursor counts GET results only. A POST response must never advance it:
// another person's message may have arrived immediately before our own.
export async function pollMessages(
  fetchPage: (offset: number) => Promise<ChatMessage[]>,
  offset: number,
  receive: (messages: ChatMessage[]) => void,
  isActive: () => boolean,
  pageSize = 100,
): Promise<number> {
  let cursor = offset;
  while (isActive()) {
    const batch = await fetchPage(cursor);
    if (!isActive()) return offset;
    receive(batch);
    cursor += batch.length;
    if (batch.length < pageSize) return cursor;
  }
  return cursor;
}
