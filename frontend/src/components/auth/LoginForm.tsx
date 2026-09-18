import React, { useState } from 'react';
import type { AuthResponse } from '../../types/auth';
import { login } from '../../lib/api';
import { DEMO_PERSONAS, type DemoPersona } from '../../lib/demoPersonas';

interface LoginFormProps {
  onSuccess: (auth: AuthResponse) => void;
  onSwitchToSignup: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess, onSwitchToSignup }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both your email and password.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const auth = await login({ email, password });
      onSuccess(auth);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDemo = (persona: DemoPersona) => {
    setEmail(persona.email);
    setPassword(persona.password);
    setError(null);
  };

  return (
    <div style={{ padding: '0 20px 32px' }}>
      {/* Editorial Headline */}
      <div style={{ marginBottom: '24px', textAlign: 'center' }}>
        <h2
          className="font-serif"
          style={{
            fontSize: '28px',
            lineHeight: '36px',
            fontWeight: 600,
            color: 'var(--color-on-surface)',
            letterSpacing: '-0.015em',
            margin: '0 0 6px',
          }}
        >
          Welcome Back
        </h2>
        <p
          style={{
            fontSize: '14px',
            color: 'var(--color-on-surface-variant)',
            lineHeight: '20px',
          }}
        >
          Log in to continue swiping and chatting with compatible roommates.
        </p>
      </div>

      {/* Quick Judge/Demo Personas Bar */}
      <div
        style={{
          background: 'var(--color-surface-container-low)',
          border: '1px solid var(--color-outline-variant)',
          borderRadius: 'var(--radius-xl)',
          padding: '14px',
          marginBottom: '24px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '10px',
          }}
        >
          <span
            className="material-symbols-outlined filled"
            style={{ fontSize: '18px', color: 'var(--color-primary)' }}
          >
            bolt
          </span>
          <span
            style={{
              fontSize: '12px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'var(--color-primary)',
            }}
          >
            Quick Demo Personas (1-Click Fill)
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '8px',
          }}
        >
          {DEMO_PERSONAS.slice(0, 4).map((persona) => {
            const isSelected = email.toLowerCase() === persona.email.toLowerCase();
            return (
              <button
                key={persona.email}
                type="button"
                onClick={() => handleSelectDemo(persona)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-md)',
                  background: isSelected
                    ? 'var(--color-primary-fixed)'
                    : 'var(--color-surface-container-lowest)',
                  border: isSelected
                    ? '1.5px solid var(--color-primary)'
                    : '1px solid var(--color-outline-variant)',
                  textAlign: 'left',
                }}
              >
                <img
                  src={persona.avatar}
                  alt={persona.name}
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    flexShrink: 0,
                  }}
                />
                <div style={{ overflow: 'hidden' }}>
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--color-on-surface)',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                    }}
                  >
                    {persona.name}
                  </div>
                  <div
                    style={{
                      fontSize: '10px',
                      color: 'var(--color-tertiary)',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                    }}
                  >
                    {persona.role}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div
          style={{
            background: 'var(--color-error-container)',
            border: '1px solid var(--color-error)',
            borderRadius: 'var(--radius-lg)',
            padding: '12px 14px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
          }}
        >
          <span
            className="material-symbols-outlined filled"
            style={{ fontSize: '20px', color: 'var(--color-error)' }}
          >
            error
          </span>
          <span
            style={{
              fontSize: '13px',
              color: 'var(--color-on-error-container)',
              lineHeight: '18px',
            }}
          >
            {error}
          </span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label
            htmlFor="login-email"
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--color-on-surface-variant)',
              marginBottom: '6px',
            }}
          >
            Email Address
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id="login-email"
              type="email"
              placeholder="e.g. demo1@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              style={{
                paddingLeft: '40px',
              }}
            />
            <span
              className="material-symbols-outlined"
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-outline)',
                pointerEvents: 'none',
                fontSize: '20px',
              }}
            >
              mail
            </span>
          </div>
        </div>

        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '6px',
            }}
          >
            <label
              htmlFor="login-password"
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--color-on-surface-variant)',
              }}
            >
              Password
            </label>
            <span
              style={{
                fontSize: '12px',
                color: 'var(--color-primary)',
                cursor: 'pointer',
                fontWeight: 500,
              }}
              onClick={() => alert('Demo passwords are: PropVibe-demo-2026')}
            >
              Forgot password?
            </span>
          </div>
          <div style={{ position: 'relative' }}>
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              style={{
                paddingLeft: '40px',
                paddingRight: '40px',
              }}
            />
            <span
              className="material-symbols-outlined"
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-outline)',
                pointerEvents: 'none',
                fontSize: '20px',
              }}
            >
              lock
            </span>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                color: 'var(--color-outline)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px',
              }}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                {showPassword ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          </div>
        </div>

        {/* Submit CTA */}
        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: '8px',
            height: '48px',
            borderRadius: 'var(--radius-full)',
            background: 'var(--color-primary)',
            color: 'var(--color-on-primary)',
            fontSize: '15px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: 'var(--shadow-warm)',
          }}
        >
          {loading ? (
            <>
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: '20px',
                  animation: 'spin 1s linear infinite',
                }}
              >
                progress_activity
              </span>
              <span>Authenticating...</span>
            </>
          ) : (
            <>
              <span>Sign In to PropVibe</span>
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                arrow_forward
              </span>
            </>
          )}
        </button>
      </form>

      {/* Switch to Signup */}
      <div
        style={{
          marginTop: '28px',
          textAlign: 'center',
          fontSize: '14px',
          color: 'var(--color-on-surface-variant)',
        }}
      >
        New to PropVibe?{' '}
        <button
          type="button"
          onClick={onSwitchToSignup}
          style={{
            background: 'none',
            color: 'var(--color-primary)',
            fontWeight: 600,
            fontSize: '14px',
            textDecoration: 'underline',
            padding: 0,
          }}
        >
          Create your Vibe profile
        </button>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
