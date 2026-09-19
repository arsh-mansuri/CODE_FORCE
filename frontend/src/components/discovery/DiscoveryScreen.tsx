import { useEffect, useState } from 'react';
import type { UserProfile } from '../../types/auth';
import type { DiscoveryCandidate } from '../../types/discovery';
import { fetchFeed, getStoredToken, swipeCandidate } from '../../lib/api';
import { discoveryCandidate } from '../../lib/feedMapper';
import { DISCOVERY_CANDIDATES } from '../../lib/discoveryData';
import { DiscoveryFeed } from './DiscoveryFeed';
import { historyFor, saveDiscoveryHistory, shouldRefine, type DiscoveryHistory } from '../../lib/discoveryHistory';
import '../auth/Profile.css';

export function DiscoveryScreen({ user, onCompleteProfile, onManagePhotos }: {
  user: UserProfile; onCompleteProfile: () => void; onManagePhotos: () => void;
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
      : fetchFeed().then(feed => ({ items: feed.items.map(discoveryCandidate), passes: feed.passed_count || 0 }));
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

  async function swipe(id: string, direction: 'like' | 'pass') {
    if (!demo) await swipeCandidate(id, direction);
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
      : items.length ? <DiscoveryFeed candidates={items} onSwipe={swipe} />
      : <div className="profile-page"><h2>You’re all caught up</h2><p>We’ve included available alternatives in your city, even when some preferences differ. Check back for new people or update your search.</p>
        <button type="button" className="primary-button" onClick={onCompleteProfile}>Edit / complete profile</button></div>}
  </>;
}
