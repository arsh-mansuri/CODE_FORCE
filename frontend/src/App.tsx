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
import { ReviewsPage } from './components/reviews/ReviewsPage';
import { AuthShell } from './components/auth/AuthShell';
import './App.css';

export function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => getStoredUser());
  const [activeTab, setActiveTab] = useState<NavTab>('discover');
  const [newMatch, setNewMatch] = useState<MatchConnection | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<MatchConnection | null>(null);
  const [reviewPropertyId, setReviewPropertyId] = useState<string | null>(null);
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
    setReviewPropertyId(null);
    setProfileTask(auth.user.offering && !auth.user.offering.media.ready ? 'media' : null);
  };

  const handleLogout = () => {
    void logout();
    setCurrentUser(null);
    setActiveTab('discover');
    setNewMatch(null);
    setSelectedMatch(null);
    setReviewPropertyId(null);
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
        onReviewProperty={propertyId => { setReviewPropertyId(propertyId); setActiveTab('reviews'); window.scrollTo(0, 0); }}
        onDiscover={() => setActiveTab('discover')} />}

      {/* Tab 2: Curated Explore Flats */}
      {!profileTask && activeTab === 'explore' && (
        <CuratedFlatsView key={currentUser.id} currentUser={currentUser} onManagePhotos={() => setProfileTask('media')}
          onOpenMatches={() => { setSelectedMatch(null); setActiveTab('matches'); }} />
      )}

      {/* Tab 3: Roommate Reviews & Trust Network */}
      {!profileTask && activeTab === 'reviews' && <ReviewsPage key={currentUser.id} user={currentUser} initialPropertyId={reviewPropertyId}
        onDiscover={() => { setActiveTab('discover'); window.scrollTo(0, 0); }} />}

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
