import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { getConnectionRequests, getMatches, postSwipe } from '../../lib/api';
import { toDiscoveryCandidate } from '../../lib/discoveryApi';
import type { ConnectionRequestView, MatchView } from '../../types/connections';

interface ConnectionInboxProps {
  onResolved?: () => void;
}

const avatar = (name: string, url?: string): React.ReactNode => (
  url ? (
    <img
      src={url}
      alt={name}
      style={{
        width: '44px', height: '44px', borderRadius: 'var(--radius-full)',
        objectFit: 'cover', border: '1px solid var(--color-outline-variant)',
      }}
    />
  ) : (
    <div
      style={{
        width: '44px', height: '44px', borderRadius: 'var(--radius-full)',
        background: 'var(--color-secondary-container)', color: 'var(--color-on-secondary-container)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '16px', fontWeight: 700,
      }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  )
);

export const ConnectionInbox: React.FC<ConnectionInboxProps> = ({ onResolved }) => {
  const [requests, setRequests] = useState<ConnectionRequestView[] | null>(null);
  const [matches, setMatches] = useState<MatchView[] | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const refresh = () => {
    void getConnectionRequests().then(r => setRequests(r?.items ?? null));
    void getMatches().then(m => setMatches(m ?? null));
  };

  useEffect(() => {
    refresh();
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  };

  const run = async (type: 'accept' | 'decline', request: ConnectionRequestView) => {
    setWorkingId(request.id);
    const result = await postSwipe(request.requester.id, type === 'accept' ? 'like' : 'pass');
    setWorkingId(null);
    if (result?.matched) {
      confetti({
        particleCount: 90, spread: 75, origin: { y: 0.6 },
        colors: ['#923326', '#2a6a48', '#ffdad4', '#aceec4'],
      });
      showToast("It's a match! In-app chat is coming next.");
    } else if (type === 'accept') {
      showToast('Not a match yet, but your like is saved.');
    }
    refresh();
    onResolved?.();
  };

  const ready = requests !== null && matches !== null;
  const total = (requests?.length ?? 0) + (matches?.length ?? 0);
  if (!ready || total === 0) return null;

  return (
    <div
      style={{
        width: '100%', padding: '0 20px 24px',
        display: 'flex', flexDirection: 'column', gap: '16px',
      }}
    >
      {toast && (
        <div style={{
          position: 'fixed', top: '64px', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(32, 27, 23, 0.92)', color: '#ffffff', padding: '8px 18px',
          borderRadius: 'var(--radius-full)', fontSize: '13px', fontWeight: 600,
          zIndex: 120, boxShadow: '0 4px 14px rgba(0,0,0,0.2)', animation: 'fadeIn 0.2s ease',
        }}>
          {toast}
        </div>
      )}

      {requests!.length > 0 && (
        <section
          style={{
            background: 'var(--color-surface-container-lowest)',
            borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-outline-variant)',
            boxShadow: '0 2px 8px rgba(32, 27, 23, 0.05)', padding: '16px',
          }}
        >
          <header style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: '20px' }}>
              mark_email_unread
            </span>
            <h3 className="font-serif" style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
              Connection requests
            </h3>
            <span
              style={{
                marginLeft: 'auto', fontSize: '11px', fontWeight: 700, padding: '2px 10px',
                borderRadius: 'var(--radius-full)', background: 'var(--color-primary-container)',
                color: 'var(--color-on-primary-container)',
              }}
            >
              {requests!.length}
            </span>
          </header>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {requests!.map(request => {
              const person = toDiscoveryCandidate(request.requester);
              return (
                <article
                  key={request.id}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: '10px',
                    background: 'var(--color-surface-container)',
                    borderRadius: 'var(--radius-lg)', padding: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
{avatar(person.name, person.photos[0]?.url)}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                        <h4 className="font-serif" style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--color-on-surface)' }}>
                          {person.name}, {person.age}
                        </h4>
                        {request.direction === 'superlike' && (
                          <span style={{
                            fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: 'var(--radius-full)',
                            background: 'var(--color-tertiary-container)', color: 'var(--color-on-tertiary-container)',
                          }}>
                            SUPERLIKE
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>
                        {person.subtitle}
                      </span>
                    </div>
                    <span style={{
                      marginLeft: 'auto', fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)',
                    }}>
                      {person.matchScore}%
                    </span>
                  </div>

                  {request.note && (
                    <div style={{
                      fontSize: '13px', lineHeight: '18px', color: 'var(--color-on-surface)',
                      background: 'var(--color-secondary-container)',
                      borderRadius: 'var(--radius-md)', padding: '10px 12px',
                      borderLeft: '3px solid var(--color-secondary)',
                    }}>
                      “{request.note}”
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      disabled={workingId === request.id}
                      onClick={() => run('accept', request)}
                      style={{
                        flex: 1, height: '40px', borderRadius: 'var(--radius-full)',
                        background: 'var(--color-primary)', color: '#ffffff',
                        fontSize: '13px', fontWeight: 600, display: 'flex',
                        alignItems: 'center', justifyContent: 'center', gap: '6px',
                        boxShadow: 'var(--shadow-warm)',
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>favorite</span>
                      Accept
                    </button>
                    <button
                      type="button"
                      disabled={workingId === request.id}
                      onClick={() => run('decline', request)}
                      style={{
                        flex: 1, height: '40px', borderRadius: 'var(--radius-full)',
                        background: 'transparent', color: 'var(--color-on-surface-variant)',
                        fontSize: '13px', fontWeight: 600, display: 'flex',
                        alignItems: 'center', justifyContent: 'center', gap: '6px',
                        border: '1px solid var(--color-outline-variant)',
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                      Decline
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {matches!.length > 0 && (
        <section
          style={{
            background: 'var(--color-surface-container-lowest)',
            borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-outline-variant)',
            boxShadow: '0 2px 8px rgba(32, 27, 23, 0.05)', padding: '16px',
          }}
        >
          <header style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span className="material-symbols-outlined filled" style={{ color: 'var(--color-secondary)', fontSize: '20px' }}>
              favorite
            </span>
            <h3 className="font-serif" style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
              Your matches
            </h3>
            <span
              style={{
                marginLeft: 'auto', fontSize: '11px', fontWeight: 700, padding: '2px 10px',
                borderRadius: 'var(--radius-full)', background: 'var(--color-secondary-container)',
                color: 'var(--color-on-secondary-container)',
              }}
            >
              {matches!.length}
            </span>
          </header>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {matches!.map(match => {
              const person = toDiscoveryCandidate(match.other_user);
              return (
                <div
                  key={match.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    background: 'var(--color-surface-container)',
                    borderRadius: 'var(--radius-lg)', padding: '10px 12px',
                  }}
                >
                  {avatar(person.name, person.photos[0]?.url)}
                  <div style={{ minWidth: 0 }}>
                    <h4 className="font-serif" style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: 'var(--color-on-surface)' }}>
                      {person.name}, {person.age}
                    </h4>
                    <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>
                      {Math.round(match.compatibility_score)}% match
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => showToast('In-app chat is coming in the next update.')}
                    style={{
                      marginLeft: 'auto', height: '34px', padding: '0 14px', borderRadius: 'var(--radius-full)',
                      background: 'var(--color-secondary)', color: '#ffffff', fontSize: '12px', fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: '6px',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>chat</span>
                    Chat
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};