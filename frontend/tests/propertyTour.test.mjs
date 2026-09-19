import assert from 'node:assert/strict';
import { after, afterEach, before, test } from 'node:test';
import { createServer } from 'vite';

let server, requestPropertyTour, ApiError;
const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const originalStorage = globalThis.localStorage;

before(async () => {
  server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  ({ requestPropertyTour, ApiError } = await server.ssrLoadModule('/src/lib/api.ts'));
  globalThis.window = { setTimeout, clearTimeout };
  globalThis.localStorage = { getItem: key => key === 'propvibe_token' ? 'seeker-session' : null };
});
afterEach(() => { globalThis.fetch = originalFetch; });
after(async () => {
  globalThis.window = originalWindow;
  globalThis.localStorage = originalStorage;
  await server?.close();
});

const listing = { id: 'property-id', owner_id: 'provider-account-id', title: 'Sunny 2BHK in Navrangpura' };

test('tour requests like the provider account with a property-specific note via the existing swipe API', async () => {
  const pending = { matched: false, match_id: null, message: 'Your choice has been saved.' };
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(new URL(url, 'http://localhost').pathname, '/api/swipe');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, 'Bearer seeker-session');
    const body = JSON.parse(options.body);
    assert.equal(body.target_id, listing.owner_id);
    assert.notEqual(body.target_id, listing.id);
    assert.equal(body.direction, 'like');
    assert.ok(body.note.includes(listing.title));
    assert.match(body.note, /arrange a tour/);
    return Response.json(pending);
  };
  assert.deepEqual(await requestPropertyTour(listing), pending);
  assert.equal(calls, 1);
});

test('an owner who has already liked the seeker returns the mutual match', async () => {
  const matched = { matched: true, match_id: 'mutual-match', message: 'Messaging is now available.' };
  globalThis.fetch = async () => Response.json(matched);
  assert.deepEqual(await requestPropertyTour(listing), matched);
});

test('photo requirements and network failures remain actionable errors instead of successful tour requests', async () => {
  globalThis.fetch = async () => Response.json({ error: {
    code: 'media_onboarding_incomplete', message: 'Upload 3 more profile photos.', fields: [],
  } }, { status: 409 });
  await assert.rejects(requestPropertyTour(listing), error => error instanceof ApiError
    && error.code === 'media_onboarding_incomplete' && error.status === 409);
  globalThis.fetch = async () => { throw new TypeError('Network unavailable'); };
  await assert.rejects(requestPropertyTour(listing), error => error instanceof ApiError && error.status === 0);
});
