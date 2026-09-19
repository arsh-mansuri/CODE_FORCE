import { useEffect, useState } from 'react';
import type { AuthResponse, UserProfile } from './types/auth';
import type { NavTab } from './components/layout/BottomNav';
import type { MatchConnection } from './types/connections';
import { getStoredUser, getStoredToken, getMe, logout, clearSession } from './lib/api';
import { TopAppBar } from './components/layout/TopAppBar';
import { BottomNav } from './components/layout/BottomNav';
import { DiscoveryScreen } from './components/discovery/DiscoveryScreen';
import { MatchesPage } from './components/connections/MatchesPage';
import { MatchCelebration } from './components/connections/MatchCelebration';
import { ProfileEditor } from './components/auth/ProfileEditor';
import { MediaOnboarding } from './components/auth/MediaOnboarding';
import { CuratedFlatsView } from './components/explore/CuratedFlatsView';
import { AuthShell } from './components/auth/AuthShell';
import './App.css';

export function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => getStoredUser());
  const [activeTab, setActiveTab] = useState<NavTab>('discover');
  const [newMatch, setNewMatch] = useState<MatchConnection | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<MatchConnection | null>(null);
  const [profileTask, setProfileTask] = useState<'details' | 'media' | null>(null);
  const [checkingSession, setCheckingSession] = useState(() => Boolean(getStoredToken()));
  const [resetToken, setResetToken] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('reset-password') || '');

  useEffect(() => {
    let active = true;
    getMe().then(user => { if (active) { setCurrentUser(user); setCheckingSession(false); } });
    const readResetToken = () => setResetToken(new URLSearchParams(window.location.hash.slice(1)).get('reset-password') || '');
    window.addEventListener('hashchange', readResetToken);
    return () => { active = false; window.removeEventListener('hashchange', readResetToken); };
  }, []);

  const handleAuthSuccess = (auth: AuthResponse) => {
    setCurrentUser(auth.user);
    setActiveTab('discover');
    setNewMatch(null);
    setSelectedMatch(null);
    setProfileTask(auth.user.offering && !auth.user.offering.media.ready ? 'media' : null);
  };

  const handleLogout = () => {
    void logout();
    setCurrentUser(null);
    setActiveTab('discover');
    setNewMatch(null);
    setSelectedMatch(null);
    setProfileTask(null);
  };

  if (checkingSession && !resetToken) return <main className="auth-shell"><div className="flow-page"><p role="status">Getting your PropVibe ready…</p></div></main>;

  if (!currentUser || resetToken) return <AuthShell
    currentUser={currentUser} onAuthSuccess={handleAuthSuccess} onUserUpdate={setCurrentUser} onLogout={handleLogout}
    resetToken={resetToken} onResetDone={() => {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      clearSession(); setCurrentUser(null); setResetToken('');
    }}
  />;

  return (
    <div className="propvibe-app" style={{ background: 'var(--color-surface)', minHeight: '100vh' }}>
      {/* Discover is the default; mutual connections live in Matches. */}
      {profileTask === 'details' && <ProfileEditor user={currentUser} onCancel={() => setProfileTask(null)} onSave={updated => {
        setCurrentUser(updated); setProfileTask(null);
      }} />}
      {profileTask === 'media' && <MediaOnboarding user={currentUser} editing onLogout={handleLogout} onUserUpdate={setCurrentUser} onFinish={updated => {
        setCurrentUser(updated); setProfileTask(null);
      }} />}
      {!profileTask && activeTab === 'discover' && (
        <>
          <TopAppBar
            city={currentUser.profile.search?.location.city || currentUser.offering?.location.city || 'Ahmedabad'}
            area={currentUser.profile.search?.location.areas.join(', ') || currentUser.offering?.location.area || 'Navrangpura'}
            onFilterClick={() => setProfileTask('details')}
          />
          <main style={{ width: '100%' }}>
            <DiscoveryScreen key={currentUser.id} user={currentUser} onMatched={setNewMatch}
              onCompleteProfile={() => setProfileTask('details')} onManagePhotos={() => setProfileTask('media')} />
          </main>
        </>
      )}

      {!profileTask && activeTab === 'matches' && <MatchesPage key={currentUser.id} user={currentUser}
        selected={selectedMatch} onSelect={setSelectedMatch} onMatched={setNewMatch}
        onDiscover={() => setActiveTab('discover')} />}

      {/* Tab 2: Curated Explore Flats */}
      {!profileTask && activeTab === 'explore' && (
        <CuratedFlatsView key={currentUser.id} currentUser={currentUser} onManagePhotos={() => setProfileTask('media')}
          onOpenMatches={() => { setSelectedMatch(null); setActiveTab('matches'); }} />
      )}

      {/* Tab 3: Roommate Reviews & Trust Network */}
      {!profileTask && activeTab === 'reviews' && (
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
                author: 'Priya Sharma (Previous Flatmate)',
                target: 'Ananya Desai',
                period: '2024–2025 in Navrangpura, Ahmedabad',
                text: '“Ananya was the dream flatmate. Kept the balcony chai garden spotless, split Torrent Power bills on the 1st via UPI without reminders, and is exceptionally mindful during WFH calls.”',
                badges: ['Cleanliness 10/10', 'Quiet Hours', 'UPI Prompt'],
              },
              {
                author: 'Aarav Shah',
                target: 'Ananya Desai',
                period: '2023–2024 in Bodakdev',
                text: '“Super respectful of private space, shared delicious home-cooked meals, and hosted calm Sunday morning acoustic sessions. Couldn’t recommend her more highly.”',
                badges: ['Verified Leaseholder', 'Polite & Mindful'],
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
      {!profileTask && activeTab === 'profile' && (
        <div style={{ paddingBottom: '70px', width: '100%' }}>
          <AuthShell
            currentUser={currentUser}
            onAuthSuccess={handleAuthSuccess}
            onUserUpdate={setCurrentUser}
            onLogout={handleLogout}
          />
        </div>
      )}

      {/* Global Bottom Navigation */}
      <BottomNav activeTab={activeTab} onTabChange={tab => { setActiveTab(tab); setProfileTask(null); window.scrollTo(0, 0); }} />
      {newMatch && <MatchCelebration user={currentUser} match={newMatch} onLater={() => setNewMatch(null)}
        onMessage={() => { setSelectedMatch(newMatch); setNewMatch(null); setProfileTask(null); setActiveTab('matches'); window.scrollTo(0, 0); }} />}
    </div>
  );
}

export default App;
