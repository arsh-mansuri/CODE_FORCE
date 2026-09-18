import { useRef, useState } from 'react';
import type { UserProfile } from '../../types/auth';
import { getStoredToken, setAccountDeletionRequested } from '../../lib/api';

export function AccountDeletionPanel({ user, onUserUpdate }: {
  user: UserProfile;
  onUserUpdate: (user: UserProfile) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);
  const status = useRef<HTMLParagraphElement>(null);
  const pending = user.deletion_request;
  const offline = getStoredToken()?.startsWith('offline_demo_');

  async function updateRequest(requested: boolean) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const updated = await setAccountDeletionRequested(requested);
      onUserUpdate(updated);
      setConfirming(false);
      setNotice(requested ? 'Your deletion request has been saved.' : 'Deletion request canceled. Your account will be kept.');
      requestAnimationFrame(() => status.current?.focus());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update your request. Please try again.');
    } finally { setBusy(false); }
  }

  return <section className="account-deletion-panel" aria-labelledby="account-deletion-title" aria-busy={busy}>
    <h2 id="account-deletion-title">Account settings</h2>
    {offline && <p className="input-hint">Demo account: deletion requests are saved on this device only.</p>}
    {pending ? <>
      <div className="account-deletion-status">
        <span className="material-symbols-outlined" aria-hidden="true">event_busy</span>
        <div><h3>Deletion requested</h3><p>Your account is flagged for deletion on <time dateTime={pending.scheduled_for}>{new Date(pending.scheduled_for).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })}</time>.</p>
          <p>You can cancel this request while it is pending.</p></div>
      </div>
      <button type="button" className="secondary-button" disabled={busy} onClick={() => updateRequest(false)}>{busy ? 'Canceling…' : 'Cancel deletion request'}</button>
    </> : confirming ? <div className="account-deletion-confirmation">
      <h3>Request account deletion?</h3>
      <p>Confirming flags your account for deletion in 7 days. You can cancel the request from this page while it is pending.</p>
      <div className="account-deletion-actions">
        <button type="button" className="secondary-button" disabled={busy} onClick={() => {
          setConfirming(false); setError(''); requestAnimationFrame(() => trigger.current?.focus());
        }}>Keep my account</button>
        <button type="button" className="primary-button" disabled={busy} onClick={() => updateRequest(true)}>{busy ? 'Requesting…' : 'Confirm deletion request'}</button>
      </div>
    </div> : <>
      <p>Ready to leave? Request to have your account flagged for deletion in 7 days.</p>
      <button ref={trigger} type="button" className="text-button account-delete-button" onClick={() => { setConfirming(true); setNotice(''); setError(''); }}>Request account deletion</button>
    </>}
    {notice && <p ref={status} tabIndex={-1} className="profile-save-notice" role="status">{notice}</p>}
    {error && <p className="flow-error" role="alert">{error}</p>}
  </section>;
}
