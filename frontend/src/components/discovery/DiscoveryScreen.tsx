import { useEffect, useState } from 'react';
import type { UserProfile } from '../../types/auth';
import type { DiscoveryCandidate } from '../../types/discovery';
import type { MatchConnection } from '../../types/connections';
import { fetchFeed, getStoredToken, postSwipe } from '../../lib/api';
import { toDiscoveryCandidate } from '../../lib/discoveryApi';
import { DISCOVERY_CANDIDATES } from '../../lib/discoveryData';
import { DiscoveryFeed } from './DiscoveryFeed';
import { historyFor, saveDiscoveryHistory, shouldRefine, type DiscoveryHistory } from '../../lib/discoveryHistory';
import '../auth/Profile.css';
import './DiscoveryScreen.css';

export function DiscoveryScreen({ user, onCompleteProfile, onManagePhotos, onMatched }: {
  user: UserProfile; onCompleteProfile: () => void; onManagePhotos: () => void;
  onMatched: (match: MatchConnection) => void;
}) {
  const [items, setItems] = useState<DiscoveryCandidate[]>([]);
  const [history, setHistory] = useState(() => historyFor(user.id));
  const [passedCount, setPassedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const demo = getStoredToken()?.startsWith('offline_demo_');

  useEffect(() => {
    let active = true;
    const result = demo
      ? Promise.resolve({ items: DISCOVERY_CANDIDATES.filter(item => !historyFor(user.id).choices[item.id]), passes: 0 })
      : fetchFeed().then(feed => ({ items: feed.items.map(toDiscoveryCandidate), passes: feed.passed_count || 0 }));
    result.then(feed => {
      if (active) { setItems(feed.items); setPassedCount(feed.passes); }
    }).catch(err => { if (active) setError(err instanceof Error ? err.message : 'Unable to load suggestions.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user, demo, refresh]);

  function reload() { setLoading(true); setError(''); setRefresh(value => value + 1); }

  function saveHistory(next: DiscoveryHistory) {
    setHistory(next);
    saveDiscoveryHistory(user.id, next);
  }

  async function swipe(id: string, direction: 'like' | 'pass', note?: string) {
    if (!demo) {
      const result = await postSwipe(id, direction, note);
      const person = items.find(item => item.id === id);
      if (result.matched && result.match_id && person) onMatched({ id: result.match_id, person });
    }
    saveHistory({ ...history, choices: { ...history.choices, [id]: direction } });
    if (direction === 'pass') setPassedCount(count => count + 1);
    setItems(previous => previous.filter(item => item.id !== id));
    if (!demo && items.length === 1) reload();
  }

  return <>
    {shouldRefine(history, passedCount) && <section className="preference-nudge" aria-labelledby="refine-heading">
      <p className="eyebrow">Let’s find a better fit</p>
      <h2 id="refine-heading">Not quite your people yet?</h2>
      <p>You’ve passed on a couple of profiles. Add a few preferences so we can understand you better and put better-fitting options first.</p>
      <div className="flow-action-row">
        <button type="button" className="primary-button" onClick={onCompleteProfile}>Add preferences</button>
        <button type="button" className="text-button" onClick={() => saveHistory({ ...history, reminderDismissed: true })}>Maybe later</button>
      </div>
    </section>}
    {!user.onboarding.complete && <section className="preference-nudge">
      <p>Browse now. Add your photos before sending a connection request.</p>
      <button type="button" className="secondary-button" onClick={onManagePhotos}>Add photos</button>
    </section>}
    {loading ? <p className="profile-page" role="status">Finding your next possibilities…</p>
      : error ? <div className="profile-page"><p role="alert">{error}</p><button className="secondary-button" onClick={reload}>Try again</button></div>
      : items.length ? <DiscoveryFeed candidates={items} onSwipe={swipe} onSendNote={(id, note) => swipe(id, 'like', note)} />
      : <section className="discovery-empty" aria-labelledby="discovery-empty-heading">
        <div className="discovery-empty-card">
          <div className="discovery-empty-art" aria-hidden="true">
            <div className="discovery-empty-orbit" />
            <div className="discovery-empty-home">
              <span className="material-symbols-outlined">home</span>
              <span className="discovery-empty-home-line" />
              <span className="discovery-empty-home-line short" />
            </div>
            <span className="discovery-empty-spark material-symbols-outlined">auto_awesome</span>
            <span className="discovery-empty-check material-symbols-outlined">check</span>
          </div>
          <p className="discovery-empty-eyebrow">A little pause. More possibilities.</p>
          <h2 id="discovery-empty-heading">You’re all<br /><em>caught up.</em></h2>
          <p className="discovery-empty-description">You’ve explored the available people in your city. Your next great housemate could be just around the corner.</p>
          <div className="discovery-empty-note">
            <span className="material-symbols-outlined" aria-hidden="true">tune</span>
            <p>We’ve also included alternatives in your city with a few different preferences. Fine-tune your profile to help us find your fit.</p>
          </div>
          <div className="discovery-empty-actions">
            <button type="button" className="primary-button" onClick={onCompleteProfile}>
              <span className="material-symbols-outlined" aria-hidden="true">edit</span>
              Update your profile
              <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
            </button>
            <button type="button" className="text-button" onClick={reload}>
              <span className="material-symbols-outlined" aria-hidden="true">refresh</span>
              Check for new people
            </button>
          </div>
        </div>
        <p className="discovery-empty-footer">Good connections are worth the wait.</p>
      </section>}
  </>;
}
