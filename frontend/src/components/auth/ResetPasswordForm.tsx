import { useState, type FormEvent } from 'react';
import { clearSession, resetPassword } from '../../lib/api';
import { StepHeader } from './StepHeader';

export function ResetPasswordForm({ token, onDone }: { token: string; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    if (password !== confirmation) { setError('Your passwords don’t match yet.'); return; }
    setLoading(true);
    setError('');
    try {
      await resetPassword(token, password);
      clearSession();
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      setDone(true);
      setPassword('');
      setConfirmation('');
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to reset your password.'); }
    finally { setLoading(false); }
  }
  return <form className="flow-page" onSubmit={submit}>
    <div className="flow-content">
      <StepHeader title={done ? 'You’re all set.' : 'A fresh start.'} icon="lock_reset" description={done ? 'Your password is updated. Sign in to pick up where you left off.' : 'Choose a new password with 10–128 characters.'} />
      {!done && <>
        <label className="flow-label">New password<input type="password" autoComplete="new-password" minLength={10} maxLength={128} required value={password} disabled={loading} onChange={e => setPassword(e.target.value)} /></label>
        <label className="flow-label">Confirm new password<input type="password" autoComplete="new-password" minLength={10} maxLength={128} required value={confirmation} disabled={loading} onChange={e => setConfirmation(e.target.value)} /></label>
      </>}
      {error && <p role="alert" className="flow-error">{error}</p>}
    </div>
    <footer className="flow-actions">
      {done ? <button type="button" className="primary-button" onClick={onDone}>Back to sign in</button> : <>
        <button className="primary-button" disabled={loading}>{loading ? 'Updating…' : 'Save new password'}</button>
        <button type="button" className="text-button" onClick={onDone} disabled={loading}>Back to sign in / request a new link</button>
      </>}
    </footer>
  </form>;
}
