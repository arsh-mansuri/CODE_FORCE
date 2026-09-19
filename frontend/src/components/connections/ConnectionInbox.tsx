import { useEffect, useRef, useState } from 'react';
import { getConnectionRequests, postSwipe } from '../../lib/api';
import { toDiscoveryCandidate } from '../../lib/discoveryApi';
import type { ConnectionRequestView, ConnectionRequestsResponse, MatchConnection } from '../../types/connections';
import { ConnectionAvatar } from './ConnectionAvatar';

export function ConnectionInbox({ onMatched, onResolved }: {
  onMatched: (match: MatchConnection) => void;
  onResolved: () => void;
}) {
  const [page, setPage] = useState<ConnectionRequestsResponse | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  const busy = useRef(false);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const result = await getConnectionRequests();
        if (active) { setPage(result); setError(''); }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load requests.');
      } finally {
        if (active) timer = setTimeout(load, 15000);
      }
    }
    void load();
    return () => { active = false; clearTimeout(timer); };
  }, [refresh]);

  async function respond(request: ConnectionRequestView, direction: 'like' | 'pass') {
    if (busy.current) return;
    busy.current = true;
    setWorkingId(request.id); setError(''); setNotice('');
    try {
      const result = await postSwipe(request.requester.id, direction);
      setPage(previous => previous && { ...previous, items: previous.items.filter(item => item.id !== request.id), total: previous.total - 1 });
      if (result.matched && result.match_id) {
        onMatched({ id: result.match_id, person: toDiscoveryCandidate(request.requester) });
      } else {
        setNotice(direction === 'pass' ? 'Request declined.' : result.message);
      }
      onResolved();
      setRefresh(value => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save your answer. Try again.');
    } finally { busy.current = false; setWorkingId(null); }
  }

  return <section className="connection-requests" aria-labelledby="requests-title">
    <div className="connections-section-heading"><h2 id="requests-title">Likes you</h2><span>{page?.total ?? '…'}</span></div>
    {error && <div className="connections-error" role="alert">{error} <button className="connection-text-button" onClick={() => setRefresh(value => value + 1)}>Retry</button></div>}
    {notice && <p className="connections-caption" role="status">{notice}</p>}
    {!page && !error && <p className="connections-caption" role="status">Checking for new connections…</p>}
    {page?.total === 0 && <p className="connections-caption">When someone wants to connect, you’ll see them here. You decide who gets a hello.</p>}
    {page?.items.map(request => {
      const person = toDiscoveryCandidate(request.requester);
      return <article className="connection-request" key={request.id}>
        <div className="connection-person"><ConnectionAvatar name={person.name} url={person.avatarUrl} />
          <div><h3>{person.name}, {person.age}</h3><p>{person.locationCity} · {person.matchScore}% fit</p></div>
          {request.direction === 'superlike' && <span className="connection-fit">Superlike</span>}
        </div>
        {request.note && <blockquote>“{request.note}”</blockquote>}
        <div className="connection-actions">
          <button className="connection-secondary" disabled={workingId !== null} onClick={() => void respond(request, 'pass')}>Pass</button>
          <button className="connection-primary" disabled={workingId !== null} onClick={() => void respond(request, 'like')}>
            {workingId === request.id ? 'Saving…' : 'Like back'} <span aria-hidden="true">♥</span>
          </button>
        </div>
      </article>;
    })}
    {page?.has_more && <p className="connections-caption">{page.total - page.items.length} more waiting. Answer these to see the next requests.</p>}
  </section>;
}
