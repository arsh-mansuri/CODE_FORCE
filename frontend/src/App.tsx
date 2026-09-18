import { useState } from 'react';
import type { AuthResponse, UserProfile } from './types/auth';
import type { NavTab } from './components/layout/BottomNav';
import { getStoredUser, clearSession } from './lib/api';
import { TopAppBar } from './components/layout/TopAppBar';
import { BottomNav } from './components/layout/BottomNav';
import { DiscoveryFeed } from './components/discovery/DiscoveryFeed';
import { AuthShell } from './components/auth/AuthShell';
import { DISCOVERY_CANDIDATES } from './lib/discoveryData';
import './App.css';

export function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => getStoredUser());
  const [activeTab, setActiveTab] = useState<NavTab>('match');

  const handleAuthSuccess = (auth: AuthResponse) => {
    setCurrentUser(auth.user);
  };

  const handleLogout = () => {
    clearSession();
    setCurrentUser(null);
  };

  return (
    <div className="propvibe-app" style={{ background: 'var(--color-surface)', minHeight: '100vh' }}>
      {/* Tab 1: Roommate Match Discovery Feed (Default) */}
      {activeTab === 'match' && (
        <>
          <TopAppBar
            city="Brooklyn, NY"
            area="Bushwick"
            onFilterClick={() => {
              // Quick filter toggle toast or notification
              alert('Filter: Bushwick & East Williamsburg • Budget: $1,200 - $2,000');
            }}
          />
          <main style={{ width: '100%' }}>
            <DiscoveryFeed candidates={DISCOVERY_CANDIDATES} />
          </main>
        </>
      )}

      {/* Tab 2: Curated Explore Flats */}
      {activeTab === 'explore' && (
        <div style={{ padding: '20px 20px 80px', width: '100%' }}>
          <header style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: '22px' }}>
                apartment
              </span>
              <h2 className="font-serif" style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>
                Curated Flats
              </h2>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)', margin: 0 }}>
              Verified properties primed for Sperner Fair-Rent splitting in Brooklyn
            </p>
          </header>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                background: 'var(--color-surface-container-lowest)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--color-outline-variant)',
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(32, 27, 23, 0.05)',
              }}
            >
              <img
                src="https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=900&auto=format&fit=crop&q=80"
                alt="Bushwick Loft"
                style={{ width: '100%', height: '180px', objectFit: 'cover' }}
              />
              <div style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <h3 className="font-serif" style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>
                    Jefferson St Sunlit Loft
                  </h3>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-primary)' }}>
                    $3,400/mo total
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', margin: '4px 0 12px' }}>
                  2 Bed • 1.5 Bath • In-unit Laundry • 4 min to Morgan L
                </p>
                <div
                  style={{
                    background: 'var(--color-secondary-container)',
                    color: 'var(--color-on-secondary-container)',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '12px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--color-secondary)' }}>
                    balance
                  </span>
                  <span>Sperner Fair Split: Master $1,850 · Corner $1,550</span>
                </div>
              </div>
            </div>

            <div
              style={{
                background: 'var(--color-surface-container-lowest)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--color-outline-variant)',
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(32, 27, 23, 0.05)',
              }}
            >
              <img
                src="https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=900&auto=format&fit=crop&q=80"
                alt="Williamsburg Duplex"
                style={{ width: '100%', height: '180px', objectFit: 'cover' }}
              />
              <div style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <h3 className="font-serif" style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>
                    Bedford Ave Exposed Brick Flat
                  </h3>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-primary)' }}>
                    $4,200/mo total
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', margin: '4px 0 12px' }}>
                  3 Bed • 2 Bath • Private Terrace • Bedford L
                </p>
                <div
                  style={{
                    background: 'var(--color-secondary-container)',
                    color: 'var(--color-on-secondary-container)',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '12px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--color-secondary)' }}>
                    balance
                  </span>
                  <span>Sperner Fair Split: Balcony $1,550 · Master $1,450 · Den $1,200</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Roommate Reviews & Trust Network */}
      {activeTab === 'reviews' && (
        <div style={{ padding: '20px 20px 80px', width: '100%' }}>
          <header style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--color-secondary)', fontSize: '22px' }}>
                verified_user
              </span>
              <h2 className="font-serif" style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>
                Vibe Endorsements
              </h2>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)', margin: 0 }}>
              Mutual trust vouching & roommate references verified via Double-Opt-In
            </p>
          </header>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              {
                author: 'Maya Lin (Previous Roommate)',
                target: 'Elena Vance',
                period: '2024–2025 in Crown Heights',
                text: '“Elena was the dream flatmate. Kept the espresso setup spotless, paid her Splitwise share on the 1st without reminders, and is exceptionally mindful during WFH calls.”',
                badges: ['Cleanliness 10/10', 'Quiet Hours', 'Splitwise Prompt'],
              },
              {
                author: 'David Chen',
                target: 'Elena Vance',
                period: '2023–2024 in Greenpoint',
                text: '“Super respectful of private space, easygoing about grocery sharing, and hosted calm Sunday morning vinyl sessions. Couldn’t recommend her more highly.”',
                badges: ['Verified Leaseholder', 'Sublease Graduate'],
              },
            ].map((review, i) => (
              <div
                key={i}
                style={{
                  background: 'var(--color-surface-container-lowest)',
                  borderRadius: 'var(--radius-xl)',
                  padding: '16px',
                  border: '1px solid var(--color-outline-variant)',
                  boxShadow: '0 2px 6px rgba(32, 27, 23, 0.04)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span className="material-symbols-outlined filled" style={{ fontSize: '18px', color: 'var(--color-secondary)' }}>
                    verified
                  </span>
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: 'var(--color-on-surface)' }}>
                      {review.author}
                    </h4>
                    <span style={{ fontSize: '11px', color: 'var(--color-tertiary)' }}>
                      for {review.target} • {review.period}
                    </span>
                  </div>
                </div>
                <blockquote
                  className="font-serif"
                  style={{
                    fontSize: '14px',
                    lineHeight: '20px',
                    fontStyle: 'italic',
                    color: 'var(--color-on-surface)',
                    margin: '8px 0 10px',
                  }}
                >
                  {review.text}
                </blockquote>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {review.badges.map((b, idx) => (
                    <span
                      key={idx}
                      style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--color-secondary-container)',
                        color: 'var(--color-on-secondary-container)',
                      }}
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Profile / Auth */}
      {activeTab === 'profile' && (
        <div style={{ paddingBottom: '70px', width: '100%' }}>
          <AuthShell
            currentUser={currentUser}
            onAuthSuccess={handleAuthSuccess}
            onLogout={handleLogout}
          />
        </div>
      )}

      {/* Global Bottom Navigation */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

export default App;
