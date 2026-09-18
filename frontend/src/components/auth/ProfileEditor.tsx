import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { SignupRequest, UserProfile } from '../../types/auth';
import type { Questionnaire } from '../../types/onboarding';
import { ApiError, fetchOnboardingQuestions, getStoredToken, updateProfile } from '../../lib/api';
import { questionVisible, validateAnswer } from '../../lib/onboardingValidation';
import { DynamicQuestionField } from './DynamicQuestionField';

type ProfileUpdate = Pick<SignupRequest, 'profile' | 'offering'>;

function initialDraft(user: UserProfile): ProfileUpdate {
  let offering = null;
  if (user.offering) {
    const { id: _id, owner_id: _owner, created_at: _created, media: _media, ...input } = user.offering;
    offering = input;
  }
  return structuredClone({ profile: user.profile, offering });
}

// Keep object-valued answers (budget/location) as well as their individual fields.
function flatten(value: unknown, prefix = '', answers: Record<string, unknown> = {}): Record<string, unknown> {
  if (prefix) answers[prefix] = value;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    Object.entries(value).forEach(([key, child]) => flatten(child, prefix ? `${prefix}.${key}` : key, answers));
  }
  return answers;
}

function replaceField(value: unknown, [key, ...rest]: string[], next: unknown): unknown {
  if (!key) return next;
  const object = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return { ...object, [key]: replaceField(object[key], rest, next) };
}

function editable(field: string) {
  if (field.startsWith('profile.')) return !['profile.intent', 'profile.intents'].includes(field);
  return ['title', 'description', 'property_type', 'provider_relationship', 'location', 'monthly_rent', 'deposit', 'available_from',
    'minimum_stay_months', 'available_spaces', 'furnishing', 'amenities', 'nearby_landmarks'].some(key => field === `offering.${key}`);
}

export function ProfileEditor({ user, onSave, onCancel }: {
  user: UserProfile;
  onSave: (user: UserProfile) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(() => initialDraft(user));
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [sectionId, setSectionId] = useState('account');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [errorField, setErrorField] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const errorMessage = useRef<HTMLParagraphElement>(null);
  const offline = getStoredToken()?.startsWith('offline_demo_');
  const answers = flatten(draft);
  const sections = questionnaire?.sections.map(section => ({ ...section,
    questions: section.questions.filter(question => editable(question.field) && questionVisible(question, answers)),
  })).filter(section => section.questions.length) || [];
  const active = sections.find(section => section.id === sectionId) || sections[0];

  useEffect(() => {
    heading.current?.focus();
    let mounted = true;
    fetchOnboardingQuestions().then(data => { if (mounted) setQuestionnaire(data); });
    return () => { mounted = false; };
  }, []);

  function showError(message: string, field = '') {
    const section = sections.find(item => item.questions.some(question => question.field === field || field.startsWith(`${question.field}.`)));
    if (section) setSectionId(section.id);
    setError(message); setErrorField(field);
    requestAnimationFrame(() => errorMessage.current?.focus());
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !questionnaire) return;
    for (const section of sections) {
      for (const question of section.questions) {
        const issue = validateAnswer(question, answers);
        if (issue) { showError(`${question.prompt} ${issue}`, question.field); return; }
      }
    }
    setBusy(true); setError('');
    try {
      onSave(await updateProfile({ ...draft, profile: { ...draft.profile,
        full_name: draft.profile.full_name.trim(), bio: draft.profile.bio.trim(),
        occupation: draft.profile.occupation?.trim() || null,
        gender_description: draft.profile.gender === 'self_described' ? draft.profile.gender_description : null,
      } }));
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Unable to save your profile. Please try again.',
        err instanceof ApiError ? err.field?.replace(/^body\./, '') : undefined);
    } finally { setBusy(false); }
  }

  return <form className="profile-page profile-editor" onSubmit={submit}>
    <header className="profile-toolbar"><div><p className="eyebrow">Make it yours</p><h1 ref={heading} tabIndex={-1}>Edit profile</h1></div>
      <button type="button" className="secondary-button" disabled={busy} onClick={onCancel}>Cancel</button>
    </header>
    <p className="profile-editor-note">Update your details, then save to see your refreshed profile.{offline && ' Demo changes are saved on this device.'}</p>
    {!questionnaire && <p role="status">Loading your details…</p>}
    <nav className="profile-editor-sections" aria-label="Profile sections">{sections.map(section =>
      <button key={section.id} type="button" aria-pressed={active?.id === section.id} disabled={busy}
        className={`choice-button ${active?.id === section.id ? 'is-selected' : ''}`} onClick={() => setSectionId(section.id)}>{section.title}</button>)}
    </nav>
    {error && <p ref={errorMessage} tabIndex={-1} className="flow-error" role="alert">{error}</p>}
    {active && <section className="profile-editor-fields" aria-label={active.title} key={active.id}>
      {active.questions.map(question => <div key={question.field} className={`profile-editor-field ${errorField === question.field ? 'has-error' : ''}`}>
        <h2>{question.prompt}{question.required && <span aria-label="required"> *</span>}</h2>
        {question.help_text && <p className="input-hint">{question.help_text}</p>}
        <DynamicQuestionField question={question} value={answers[question.field]} allAnswers={answers} disabled={busy}
          onChange={value => { setError(''); setErrorField(''); setDraft(previous => replaceField(previous, question.field.split('.'), value) as ProfileUpdate); }} />
      </div>)}
    </section>}
    <footer className="profile-edit-actions">
      <button type="button" className="secondary-button" disabled={busy} onClick={onCancel}>Cancel</button>
      <button type="submit" className="primary-button" disabled={busy || !questionnaire}>{busy ? 'Saving…' : 'Save changes'}</button>
    </footer>
  </form>;
}
