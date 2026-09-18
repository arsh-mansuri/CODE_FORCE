import { useEffect, useState, type FormEvent } from 'react';
import type { AuthResponse } from '../../types/auth';
import { checkEmail, forgotPassword, login } from '../../lib/api';
import { DEMO_PERSONAS } from '../../lib/demoPersonas';
import { StepHeader } from './StepHeader';

interface LoginFormProps {
  initialEmail?: string;
  existingAccount?: boolean;
  onSuccess: (auth: AuthResponse) => void;
  onSwitchToSignup: (email: string) => void;
}

export function LoginForm({ initialEmail = '', existingAccount = false, onSuccess, onSwitchToSignup }: LoginFormProps) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'email' | 'password' | 'forgot' | 'sent'>(existingAccount ? 'password' : 'email');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [unknownEmail, setUnknownEmail] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  function go(next: typeof step) { setError(''); setStep(next); }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const normalized = email.trim().toLowerCase();
      setEmail(normalized);
      if (step === 'email') {
        const { exists } = await checkEmail(normalized);
        setUnknownEmail(!exists);
        if (exists) go('password');
      } else if (step === 'password') {
        onSuccess(await login({ email: normalized, password }));
      } else {
        await forgotPassword(normalized);
        setCooldown(60);
        go('sent');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally { setLoading(false); }
  }

  async function openDemo(index: number) {
    const persona = DEMO_PERSONAS[index];
    setLoading(true);
    setError('');
    try { onSuccess(await login({ email: persona.email, password: persona.password }, true)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Demo unavailable.'); }
    finally { setLoading(false); }
  }

  return <form className="flow-page" onSubmit={submit}>
    <div className="flow-content" key={step}>
      <StepHeader
        title={step === 'email' ? 'What’s your email?' : step === 'password' ? 'Hey, welcome back.' : step === 'forgot' ? 'Let’s get you back in.' : 'Check your inbox.'}
        icon={step === 'email' || step === 'sent' ? 'mail' : 'lock'}
        description={step === 'email' ? 'Your next chapter at home starts here.' : step === 'password' ? 'You already have an account. Simply enter your password to sign in.' : step === 'forgot' ? 'We’ll email you a link to choose a new password.' : `If ${email} has an account, a reset link is on its way. Check your spam folder too. The link is valid for 30 minutes.`}
      />
      {(step === 'email' || step === 'forgot') && <label className="flow-label" htmlFor="login-email">Email address
        <input id="login-email" type="email" autoComplete="email" value={email} required maxLength={320}
          placeholder="you@example.com" disabled={loading}
          onChange={e => { setEmail(e.target.value); setUnknownEmail(false); setError(''); }} />
      </label>}
      {step === 'password' && <>
        <div className="email-chip"><span>{email}</span><button type="button" className="text-button" disabled={loading} onClick={() => { setPassword(''); go('email'); }}>Edit</button></div>
        <label className="flow-label" htmlFor="login-password">Password</label>
        <div className="password-input">
          <input id="login-password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required maxLength={128} autoComplete="current-password" disabled={loading} />
          <button className="text-button" type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'Hide' : 'Show'}</button>
        </div>
        <button type="button" className="text-button forgot-link" disabled={loading} onClick={() => go('forgot')}>Forgot password?</button>
      </>}
      {unknownEmail && <div className="flow-notice" role="status">We couldn’t find an account with this email. Let’s create one.
        <button type="button" className="text-button" onClick={() => onSwitchToSignup(email.trim().toLowerCase())}>Create account</button>
      </div>}
      {error && <p className="flow-error" role="alert">{error}</p>}
      {step === 'email' && <details className="demo-details"><summary>Try a demo profile</summary>
        <p>A sample profile for exploring PropVibe.</p>
        <div className="choice-grid">{DEMO_PERSONAS.slice(0, 4).map((persona, index) => <button type="button" className="choice-button" key={persona.email} disabled={loading} onClick={() => openDemo(index)}>{persona.name}</button>)}</div>
      </details>}
    </div>
    <footer className="flow-actions">
      <button className="primary-button" type="submit" disabled={loading || (step === 'sent' && cooldown > 0)}>
        {loading ? 'One moment…' : step === 'email' ? 'Continue' : step === 'password' ? 'Sign in' : step === 'forgot' ? 'Send reset link' : cooldown ? `Resend in ${cooldown}s` : 'Resend reset link'}
        <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
      </button>
      <button className="text-button" type="button" disabled={loading} onClick={() => step === 'email' ? onSwitchToSignup(email) : go(step === 'password' ? 'email' : 'password')}>
        {step === 'email' ? 'New here? Create account' : step === 'password' ? 'Use another email' : 'Back to sign in'}
      </button>
    </footer>
  </form>;
}
