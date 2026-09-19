import { useEffect, useState } from 'react';
import type { UserProfile } from '../../types/auth';
import type { MatchConnection, MatchView } from '../../types/connections';
import { getMatches, getStoredToken } from '../../lib/api';
import { toDiscoveryCandidate } from '../../lib/discoveryApi';
import { ConnectionInbox } from './ConnectionInbox';
import { ConnectionAvatar } from './ConnectionAvatar';
import { MatchChat } from './MatchChat';
import './Connections.css';

export function MatchesPage({ user, selected, onSelect, onMatched, onDiscover, onReviewProperty }: {
  user: UserProfile; selected: MatchConnection | null;
  onSelect: (match: MatchConnection | null) => void;
  onMatched: (match: MatchConnection) => void; onDiscover: () => void;
  onReviewProperty: (propertyId: string) => void;
}) {
  const [matches, setMatches] = useState<MatchView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [pages, setPages] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const demo = Boolean(getStoredToken()?.startsWith('offline_demo_'));

  useEffect(() => {
    if (demo) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const items: MatchView[] = [];
        let more = false;
        for (let page = 0; page < pages; page++) {
          const batch = await getMatches(20, page * 20);
          if (!active) return;
          items.push(...batch);
          more = batch.length === 20;
          if (!more) break;
        }
        if (active) { setMatches(Array.from(new Map(items.map(item => [item.id, item])).values())); setHasMore(more); setError(''); }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load your matches.');
      } finally {
        if (active) { setLoading(false); timer = setTimeout(load, 10000); }
      }
    }
    void load();
    return () => { active = false; clearTimeout(timer); };
  }, [demo, pages, refresh]);

  if (selected && !demo) return <MatchChat key={selected.id} userId={user.id} match={selected}
    onReviewProperty={onReviewProperty}
    draft={drafts[selected.id] || ''} onDraftChange={text => setDrafts(previous => ({ ...previous, [selected.id]: text }))}
    onBack={() => { onSelect(null); setRefresh(value => value + 1); }} />;

  return <main className="matches-page">
    <header className="matches-heading"><p className="connections-eyebrow">Good spaces start with good people</p><h1>Matches<span>.</span></h1>
      <p>A mutual yes. A new conversation. Maybe home.</p></header>
    {demo ? <div className="connections-empty"><span className="material-symbols-outlined" aria-hidden="true">chat_bubble</span>
      <h2>Real connections live here.</h2><p>You’re browsing an offline demo. Sign in when the server is available to see mutual matches and send messages.</p>
      <button className="connection-primary" onClick={onDiscover}>Keep discovering</button></div> : <>
      <ConnectionInbox onMatched={onMatched} onResolved={() => setRefresh(value => value + 1)} />
      <section aria-labelledby="conversations-title">
        <div className="connections-section-heading"><h2 id="conversations-title">Your conversations</h2><span>{matches.length}{hasMore ? '+' : ''}</span></div>
        {error && <div className="connections-error" role="alert">{error} <button className="connection-text-button" onClick={() => setRefresh(value => value + 1)}>Retry</button></div>}
        {loading && <p className="connections-caption" role="status">Finding your people…</p>}
        {!loading && !error && matches.length === 0 && <div className="connections-empty">
          <span className="material-symbols-outlined" aria-hidden="true">forum</span><h2>Your next hello is out there.</h2>
          <p>Like someone in Discover. When they like you back, you can chat here about move-in dates, shared spaces, and all the little things that make a home.</p>
          <button className="connection-primary" onClick={onDiscover}>Discover your people</button>
        </div>}
        <div className="conversation-list">{matches.map(match => {
          const person = toDiscoveryCandidate(match.other_user);
          return <button className="conversation-row" key={match.id} onClick={() => onSelect({ id: match.id, person })} aria-label={`Chat with ${person.name}`}>
            <ConnectionAvatar name={person.name} url={person.avatarUrl} />
            <span className="conversation-details"><strong>{person.name}</strong><span>{person.locationCity} · {Math.round(match.compatibility_score)}% fit</span><span className="conversation-invite">Open your conversation</span></span>
            <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
          </button>;
        })}</div>
        {hasMore && <button className="connection-secondary" disabled={loading} onClick={() => { setLoading(true); setPages(value => value + 1); }}>Load more matches</button>}
      </section>
      <p className="connections-footer"><span className="material-symbols-outlined" aria-hidden="true">favorite</span> Only mutual connections. Always on your terms.</p>
    </>}
  </main>;
}
