import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

let server, fallback, signupSteps, mapper, DynamicQuestionField, history;
before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  fallback = (await server.ssrLoadModule('/src/lib/onboardingFallback.ts')).FALLBACK_QUESTIONNAIRE;
  ({ signupSteps } = await server.ssrLoadModule('/src/lib/signupQuestions.ts'));
  mapper = await server.ssrLoadModule('/src/lib/onboardingMapper.ts');
  ({ DynamicQuestionField } = await server.ssrLoadModule('/src/components/auth/DynamicQuestionField.tsx'));
  history = await server.ssrLoadModule('/src/lib/discoveryHistory.ts');
});
after(async () => { await server?.close(); });

const combinations = group => Array.from({ length: (1 << group.length) - 1 }, (_, mask) => group.filter((_, i) => (mask + 1) & (1 << i)));

test('every supported goal combination has at most ten essential signup questions', () => {
  const payloads = [];
  for (const intents of [...combinations(['seek_roommate', 'seek_room', 'seek_entire_home']), ...combinations(['offer_shared_home', 'offer_entire_home'])]) {
    const answers = {
      ...mapper.getDefaultAnswers(), email: 'new@example.com', password: 'a-long-password',
      'profile.full_name': 'New Person', 'profile.age': 24, 'profile.intents': intents, 'profile.intent': intents[0],
      'profile.search.location.city': 'Ahmedabad', 'offering.location': { city: 'Ahmedabad', area: 'Naranpura', pincode: '380013' },
      'offering.kind': intents[0] === 'offer_entire_home' ? 'entire_home' : 'private_room'
    };
    const steps = signupSteps(fallback, answers);
    assert.equal(steps.length, 10, intents.join(', '));
    assert.ok(!steps.some(({ question }) => question.field.includes('lifestyle') || question.field.includes('nearby')));
    const payload = mapper.buildSignupPayload(answers);
    assert.ok(payload.profile.lifestyle === null || Object.keys(payload.profile.lifestyle).length === 0);
    payloads.push(payload);
  }
  // Check real frontend payloads against the backend contract, not a duplicate mock.
  const result = python('import sys,json; from app.schemas import SignupRequest; [SignupRequest.model_validate(body) for body in json.load(sys.stdin)]', JSON.stringify(payloads));
  assert.equal(result.status, 0, result.stderr);
});

function python(code, input) {
  const binary = process.platform === 'win32' ? 'python' : (existsSync(resolve('../backend/.venv/bin/python')) ? resolve('../backend/.venv/bin/python') : 'python3');
  return spawnSync(binary, ['-c', code], { cwd: resolve('../backend'), input, encoding: 'utf8' });
}

test('offline questionnaire has all API fields, choices, visibility conditions and requirements', () => {
  const result = python('from app.onboarding import questionnaire; from app.config import Settings; print(questionnaire(Settings(database_url="sqlite://")).model_dump_json())');
  assert.equal(result.status, 0, result.stderr);
  const live = JSON.parse(result.stdout);
  const fields = questionnaire => Object.fromEntries(questionnaire.sections.flatMap(section => section.questions.map(q => [q.field, {
    options: q.options.map(o => o.value).sort(), required: q.required, input_type: q.input_type,
    applies_to: [...(q.applies_to?.length ? q.applies_to : ['seek_entire_home', 'seek_room', 'seek_roommate', 'offer_entire_home', 'offer_shared_home'])].sort(),
    show_when: q.show_when || {},
  }])));
  assert.deepEqual(fields(fallback), fields(live));
});

test('both nearby editors render every API landmark choice, including older empty-option responses', () => {
  for (const field of ['profile.search.location.nearby', 'offering.nearby_landmarks']) {
    const question = fallback.sections.flatMap(s => s.questions).find(q => q.field === field);
    for (const options of [question.options, []]) {
      const html = renderToStaticMarkup(createElement(DynamicQuestionField, {
        question: { ...question, options },
        value: [{ kind: 'mosque', name: 'Local place', max_distance_km: 2, distance_km: 2, importance: 'preferred' }], allAnswers: {}, onChange() { }
      }));
      for (const option of question.options) assert.ok(html.includes(`value="${option.value}"`), option.value);
    }
  }
});

test('changing utility billing drops irrelevant rates and split fields', () => {
  const electricity = mapper.buildElectricity({
    'offering.electricity.billing_method': 'included_in_rent',
    'offering.electricity.rate_per_kwh': 12, 'offering.electricity.split.method': 'equal', 'offering.electricity.split.split_between': 3
  });
  assert.deepEqual(electricity, { billing_method: 'included_in_rent' });
  const ac = mapper.buildAirConditioning({
    'offering.air_conditioning.available': false,
    'offering.air_conditioning.billing_method': 'separate_per_hour', 'offering.air_conditioning.rate_per_hour': 25,
    'offering.air_conditioning.notes': 'Repairs pending'
  });
  assert.deepEqual(ac, { available: false, notes: 'Repairs pending' });
});

test('refinement starts at two distinct passes and dismissal/profile saves persist per user', () => {
  const store = new Map();
  globalThis.localStorage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };
  let state = history.historyFor('a');
  assert.equal(history.shouldRefine(state), false);
  state.choices.first = 'pass';
  state.choices.second = 'like';
  assert.equal(history.shouldRefine(state), false);
  state.choices.second = 'pass';
  assert.equal(history.shouldRefine(state), true);
  history.saveDiscoveryHistory('a', state);
  assert.equal(history.shouldRefine(history.historyFor('a')), true);
  assert.equal(history.shouldRefine(history.historyFor('b')), false);
  assert.equal(history.shouldRefine(history.historyFor('b'), 2), true);
  history.preferencesSaved('a');
  assert.equal(history.shouldRefine(history.historyFor('a'), 5), false);
  delete globalThis.localStorage;
});


//test commit