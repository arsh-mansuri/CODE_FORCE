import { useEffect, useState, type FormEvent } from 'react';
import type { AuthResponse } from '../../types/auth';
import type { Questionnaire } from '../../types/onboarding';
import { ApiError, signup, checkEmail, fetchOnboardingQuestions } from '../../lib/api';
import { getDefaultAnswers, buildSignupPayload } from '../../lib/onboardingMapper';
import { validateAnswer } from '../../lib/onboardingValidation';
import { signupSteps } from '../../lib/signupQuestions';
import { DynamicQuestionField } from './DynamicQuestionField';
import { StepHeader } from './StepHeader';
import { INTENT_LABELS, selectedIntents } from '../../lib/intents';

interface SignupFlowProps {
  initialEmail?: string;
  onSuccess: (auth: AuthResponse) => void;
  onSwitchToLogin: (email?: string, existingAccount?: boolean) => void;
}

export function SignupFlow({ initialEmail = '', onSuccess, onSwitchToLogin }: SignupFlowProps) {
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>(() => ({ ...getDefaultAnswers(), email: initialEmail }));
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [review, setReview] = useState(false);

  useEffect(() => {
    let active = true;
    fetchOnboardingQuestions().then(data => {
      // Accept cached questionnaires from servers that still use the single-goal key.
      const normalized = { ...data, sections: data.sections.map(section => ({ ...section, questions: section.questions.map(question =>
        question.field === 'profile.intent' ? { ...question, field: 'profile.intents', input_type: 'multi_choice' as const,
          help_text: 'Choose all that feel right within one category. Choosing the other category switches your goals.' } : question,
      ) })) };
      if (active) setQuestionnaire(normalized);
    });
    return () => { active = false; };
  }, []);

  const steps = questionnaire ? signupSteps(questionnaire, answers) : [];
  const active = steps[index];

  function change(field: string, value: any) {
    setError('');
    setAnswers(previous => {
      const next = { ...previous, [field]: value };
      if (field === 'profile.intents') {
        next['profile.intent'] = value[0];
        if (!value.includes('offer_entire_home') && next['offering.kind'] === 'entire_home') next['offering.kind'] = 'private_room';
        if (!value.includes('offer_shared_home') && value.includes('offer_entire_home')) next['offering.kind'] = 'entire_home';
      }
      if (field === 'profile.search.move_in_from' && next['profile.search.move_in_by'] < value) next['profile.search.move_in_by'] = '';
      return next;
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || !active) return;
    setError('');
    if (!review) {
      const issue = validateAnswer(active.question, answers);
      if (issue) { setError(issue); return; }
      if (active.question.field === 'email') {
        const email = answers.email.trim().toLowerCase();
        setLoading(true);
        try {
          const { exists } = await checkEmail(email);
          if (exists) { onSwitchToLogin(email, true); return; }
          change('email', email);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Unable to check your email. Try again.');
          return;
        } finally { setLoading(false); }
      }
      if (index === steps.length - 1) setReview(true);
      else setIndex(index + 1);
      return;
    }

    // Recheck every visible answer, including dates if midnight passed during setup.
    const invalid = steps.findIndex(step => validateAnswer(step.question, answers));
    if (invalid >= 0) {
      setError(validateAnswer(steps[invalid].question, answers) || 'Check this answer.');
      setIndex(invalid); setReview(false); return;
    }
    setLoading(true);
    try {
      const { exists } = await checkEmail(answers.email);
      if (exists) { onSwitchToLogin(answers.email, true); return; }
      onSuccess(await signup(buildSignupPayload(answers)));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'email_in_use') { onSwitchToLogin(answers.email, true); return; }
      if (err instanceof ApiError && err.field) {
        const field = err.field.replace(/^body\./, '');
        const failed = steps.findIndex(step => step.question.field === field || step.question.field.startsWith(`${field}.`));
        if (failed >= 0) { setIndex(failed); setReview(false); }
      }
      setError(err instanceof Error ? err.message : 'Unable to create your account. Please try again.');
    } finally { setLoading(false); }
  }

  if (!questionnaire || !active) return <div className="flow-page"><p role="status">Getting your next chapter ready…</p></div>;

  const number = review ? steps.length : index + 1;
  return <form className="flow-page" onSubmit={submit}>
    <div className="flow-progress">
      <div><span>{review ? 'Ready to go' : active.section}</span><span>{number} / {steps.length}</span></div>
      <progress value={number} max={steps.length} aria-label="Profile setup progress" />
      <p className="input-hint">Just the essentials. Add your lifestyle and preferences later in Complete profile.</p>
    </div>
    <div className="flow-content" key={review ? 'review' : active.question.field}>
      <StepHeader title={review ? 'This is so you.' : active.question.prompt}
        description={review ? 'A quick look before you start exploring. You can add more later.' : active.question.help_text}
        icon={review ? 'auto_awesome' : active.question.field === 'email' ? 'mail' : active.question.field === 'password' ? 'lock' : 'person_outline'} />
      {review ? <div className="profile-preview">
        <div className="preview-monogram">{String(answers['profile.full_name']).charAt(0).toUpperCase()}</div>
        <h2>{answers['profile.full_name']}, {answers['profile.age']}</h2>
        <p>{answers['profile.occupation']}</p>
        <div className="preview-goals">{selectedIntents(answers).map(intent => <span key={intent} className="preview-intent">{INTENT_LABELS[intent]}</span>)}</div>
        {answers['profile.bio'] && <blockquote>“{answers['profile.bio']}”</blockquote>}
        <p>{answers['profile.intent'].startsWith('offer_') ? `${answers['offering.location'].city} · ₹${answers['offering.monthly_rent']}/month` : `${answers['profile.search.location.city']} · ₹${answers['profile.search.budget'].minimum}–${answers['profile.search.budget'].maximum}/month`}</p>
        <p className="muted">You can review all details and starting preferences in Complete profile.</p>
        {answers['profile.intent'].startsWith('offer_') && <p className="muted">Your property entry is created automatically with these details. Next, add 3–6 property photos to publish it in Curated Flats. Keep portraits in your personal profile gallery.</p>}
        <p className="muted">Start browsing now. Add photos of you{answers['profile.intent'].startsWith('offer_') ? ' and your home' : ''} before connecting.</p>
      </div> : <DynamicQuestionField question={active.question} value={answers[active.question.field]} onChange={value => change(active.question.field, value)} allAnswers={answers} disabled={loading} />}
      {error && <p className="flow-error" role="alert">{error}</p>}
    </div>
    <footer className="flow-actions">
      <div className="flow-action-row">
        {(index > 0 || review) && <button type="button" className="secondary-button" disabled={loading} onClick={() => { setError(''); if (review) setReview(false); else setIndex(index - 1); }}>Back</button>}
        <button type="submit" className="primary-button" disabled={loading}>{loading ? 'One moment…' : review ? 'Create account' : 'Continue'}<span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span></button>
      </div>
      {!review && !active.question.required && <button type="button" className="text-button" disabled={loading} onClick={() => {
        change(active.question.field, undefined);
        if (index === steps.length - 1) setReview(true); else setIndex(index + 1);
      }}>Skip for now</button>}
      {index === 0 && <button className="text-button" type="button" onClick={() => onSwitchToLogin(answers.email)}>Already have an account? Sign in</button>}
    </footer>
  </form>;
}
