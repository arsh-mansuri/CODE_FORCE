import React, { useState } from 'react';
import type { AuthResponse, UserProfile } from '../../types/auth';
import { LoginForm } from './LoginForm';
import { SignupFlow } from './SignupFlow';
import { UserDashboardBanner } from './UserDashboardBanner';

interface AuthShellProps {
  currentUser: UserProfile | null;
  onAuthSuccess: (auth: AuthResponse) => void;
  onLogout: () => void;
}

export const AuthShell: React.FC<AuthShellProps> = ({
  currentUser,
  onAuthSuccess,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');

  return (
    <div style={{ width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Header without logo/brand banner */}
      <header
        style={{
          padding: '16px 20px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--color-outline-variant)',
          background: 'var(--color-surface-container-lowest)',
        }}
      >
        <h2
          className="font-serif"
          style={{
            fontSize: '20px',
            fontWeight: 700,
            color: 'var(--color-on-surface)',
            letterSpacing: '-0.01em',
            margin: 0,
          }}
        >
          {currentUser ? 'Your Profile' : 'Sign In or Join'}
        </h2>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'var(--color-secondary)',
            background: 'var(--color-secondary-container)',
            padding: '2px 8px',
            borderRadius: 'var(--radius-full)',
          }}
        >
          Verified Co-Living
        </span>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, paddingTop: '20px' }}>
        {currentUser ? (
          <div>
            <div style={{ textAlign: 'center', padding: '0 20px 12px' }}>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--color-secondary)',
                  letterSpacing: '0.05em',
                }}
              >
                ● Active Authenticated Session
              </span>
            </div>
            <UserDashboardBanner
              user={currentUser}
              onLogout={onLogout}
              onSwitchPersona={() => {
                onLogout();
                setActiveTab('login');
              }}
            />
          </div>
        ) : (
          <div>
            {/* Segmented Auth Tabs */}
            <div style={{ padding: '0 20px 20px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  background: 'var(--color-surface-container-high)',
                  padding: '4px',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--color-outline-variant)',
                }}
              >
                <button
                  id="tab-login-btn"
                  type="button"
                  onClick={() => setActiveTab('login')}
                  style={{
                    padding: '9px 16px',
                    borderRadius: 'var(--radius-full)',
                    background:
                      activeTab === 'login'
                        ? 'var(--color-surface-container-lowest)'
                        : 'transparent',
                    color:
                      activeTab === 'login'
                        ? 'var(--color-primary)'
                        : 'var(--color-on-surface-variant)',
                    fontWeight: activeTab === 'login' ? 700 : 500,
                    fontSize: '14px',
                    boxShadow: activeTab === 'login' ? 'var(--shadow-xs)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                    login
                  </span>
                  <span>Sign In</span>
                </button>
                <button
                  id="tab-signup-btn"
                  type="button"
                  onClick={() => setActiveTab('signup')}
                  style={{
                    padding: '9px 16px',
                    borderRadius: 'var(--radius-full)',
                    background:
                      activeTab === 'signup'
                        ? 'var(--color-surface-container-lowest)'
                        : 'transparent',
                    color:
                      activeTab === 'signup'
                        ? 'var(--color-primary)'
                        : 'var(--color-on-surface-variant)',
                    fontWeight: activeTab === 'signup' ? 700 : 500,
                    fontSize: '14px',
                    boxShadow: activeTab === 'signup' ? 'var(--shadow-xs)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                    how_to_reg
                  </span>
                  <span>Create Account</span>
                </button>
              </div>
            </div>

            {/* Tab Views */}
            {activeTab === 'login' ? (
              <LoginForm
                onSuccess={onAuthSuccess}
                onSwitchToSignup={() => setActiveTab('signup')}
              />
            ) : (
              <SignupFlow
                onSuccess={onAuthSuccess}
                onSwitchToLogin={() => setActiveTab('login')}
              />
            )}
          </div>
        )}
      </main>

      {/* Editorial Footer / Security badges */}
      <footer
        style={{
          marginTop: 'auto',
          padding: '16px 20px 24px',
          borderTop: '1px solid var(--color-outline-variant)',
          background: 'var(--color-surface-container-low)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            fontSize: '11px',
            color: 'var(--color-on-surface-variant)',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span className="material-symbols-outlined filled" style={{ fontSize: '14px', color: 'var(--color-secondary)' }}>
              shield
            </span>
            Double-Opt-In
          </span>
          <span>•</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--color-primary)' }}>
              balance
            </span>
            Sperner Fair-Rent
          </span>
          <span>•</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--color-tertiary)' }}>
              auto_awesome
            </span>
            Irving Stable Roommates
          </span>
        </div>
        <p style={{ fontSize: '11px', color: 'var(--color-tertiary)', marginTop: '8px', margin: 0 }}>
          CodeCraft 2026 Hackathon · Track 4 PropTech
        </p>
      </footer>
    </div>
  );
};
