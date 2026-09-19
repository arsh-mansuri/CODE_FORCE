import { useState } from 'react';
import type { AuthResponse, UserProfile } from '../../types/auth';
import { LoginForm } from './LoginForm';
import { SignupFlow } from './SignupFlow';
import { ProfilePage } from './ProfilePage';
import { ResetPasswordForm } from './ResetPasswordForm';
import { MediaOnboarding } from './MediaOnboarding';
import './Auth.css';

interface AuthShellProps {
  currentUser: UserProfile | null;
  onAuthSuccess: (auth: AuthResponse) => void;
  onUserUpdate: (user: UserProfile) => void;
  onLogout: () => void;
  resetToken?: string;
  onResetDone?: () => void;
}

export function AuthShell({ currentUser, onAuthSuccess, onUserUpdate, onLogout, resetToken, onResetDone }: AuthShellProps) {
  const [screen, setScreen] = useState<'welcome' | 'login' | 'signup'>('welcome');
  const [email, setEmail] = useState('');
  const [existingAccount, setExistingAccount] = useState(false);
  const [editingMedia, setEditingMedia] = useState(false);

  function signIn(value = '', exists = false) {
    setEmail(value); setExistingAccount(exists); setScreen('login');
  }

  if (resetToken) return <main className="auth-shell"><ResetPasswordForm token={resetToken} onDone={() => { signIn(); onResetDone?.(); }} /></main>;

  if (currentUser) return <main className="auth-shell">
    {editingMedia ? <MediaOnboarding
      user={currentUser}
      onFinish={user => { onUserUpdate(user); setEditingMedia(false); }}
      onLogout={onLogout}
      onUserUpdate={onUserUpdate}
      editing={editingMedia}
    /> : <ProfilePage key={currentUser.id} user={currentUser} onUserUpdate={onUserUpdate}
      onEditMedia={() => setEditingMedia(true)} onLogout={onLogout} />}
  </main>;

  if (screen === 'welcome') return <main className="auth-welcome">
    <div className="welcome-grain" aria-hidden="true" />
    <div className="welcome-top"><span className="material-symbols-outlined" aria-hidden="true">other_houses</span><span>Good people. Better living.</span></div>
    <div className="welcome-title"><p>MAKE ROOM FOR</p><h1>your kind<br />of people<span>.</span></h1><p className="welcome-subtitle">A place that feels like home.<br />People who feel like you.</p></div>
    <div className="welcome-bottom">
      <div className="welcome-brand">PropVibe<span>Find your people. Find your place.</span></div>
      <button className="primary-button" onClick={() => { setEmail(''); setScreen('signup'); }}>Create account <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span></button>
      <button className="welcome-signin" onClick={() => signIn()}>Already here? <strong>Sign in</strong></button>
    </div>
  </main>;

  return <main className="auth-shell">
    <header className="auth-topbar">
      <button className="icon-button" aria-label="Back to welcome" onClick={() => setScreen('welcome')}><span className="material-symbols-outlined" aria-hidden="true">arrow_back</span></button>
      <span className="auth-wordmark">PropVibe</span><span className="auth-topbar-note">A little more you.</span>
    </header>
    {screen === 'login' ? <LoginForm initialEmail={email} existingAccount={existingAccount} onSuccess={onAuthSuccess} onSwitchToSignup={value => { setEmail(value); setScreen('signup'); }} />
      : <SignupFlow initialEmail={email} onSuccess={onAuthSuccess} onSwitchToLogin={signIn} />}
  </main>;
}
