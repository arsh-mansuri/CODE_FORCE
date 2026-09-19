import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let server, mergeMessages, pollMessages;
before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  ({ mergeMessages, pollMessages } = await server.ssrLoadModule('/src/lib/chat.ts'));
});
after(async () => { await server?.close(); });

const message = (id, sender = 'them') => ({
  id: String(id).padStart(4, '0'), match_id: 'mutual-match', sender_id: sender,
  content: `Message ${id}`, created_at: new Date(Date.UTC(2026, 8, 19, 12, 0, id)).toISOString(),
});

test('initial polling drains chronological history beyond the first page', async () => {
  const history = Array.from({ length: 205 }, (_, index) => message(index));
  const offsets = [];
  let displayed = [];
  const cursor = await pollMessages(async offset => {
    offsets.push(offset);
    return history.slice(offset, offset + 100);
  }, 0, batch => { displayed = mergeMessages(displayed, batch); }, () => true);
  assert.deepEqual(offsets, [0, 100, 200]);
  assert.equal(cursor, 205);
  assert.deepEqual(displayed, history);
});

test('a send racing an incoming message does not skip the reply or duplicate the sent message', async () => {
  const old = message(0), reply = message(1), sent = message(2, 'me');
  let displayed = mergeMessages([old], [sent]);
  const cursor = await pollMessages(async offset => {
    assert.equal(offset, 1, 'only messages fetched by GET advance the polling cursor');
    return [reply, sent];
  }, 1, batch => { displayed = mergeMessages(displayed, batch); }, () => true);
  assert.equal(cursor, 3);
  assert.deepEqual(displayed, [old, reply, sent]);
});

test('switching conversations ignores a late history response', async () => {
  let active = true;
  let received = false;
  const cursor = await pollMessages(async () => { active = false; return [message(1)]; }, 0,
    () => { received = true; }, () => active);
  assert.equal(received, false);
  assert.equal(cursor, 0);
});

test('a failed page can be retried without losing or duplicating earlier history', async () => {
  const history = Array.from({ length: 101 }, (_, index) => message(index));
  let displayed = [];
  const receive = batch => { displayed = mergeMessages(displayed, batch); };
  await assert.rejects(pollMessages(async offset => {
    if (offset === 100) throw new Error('offline');
    return history.slice(0, 100);
  }, 0, receive, () => true), /offline/);
  assert.equal(displayed.length, 100);
  const cursor = await pollMessages(async offset => history.slice(offset, offset + 100), 0, receive, () => true);
  assert.equal(cursor, 101);
  assert.deepEqual(displayed, history);
});
