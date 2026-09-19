import { useEffect, useRef, useState } from 'react';
import type { ChatMessage, MatchConnection } from '../../types/connections';
import { ApiError, getMessages, sendMessage } from '../../lib/api';
import { mergeMessages, pollMessages } from '../../lib/chat';
import { ConnectionAvatar } from './ConnectionAvatar';

const starters = [
  'What does your ideal weekend at home look like?',
  'When are you hoping to move in?',
  'What’s one thing that makes a place feel like home to you?',
];
const isLocked = (error: unknown) => error instanceof ApiError && [401, 404, 409].includes(error.status);
const messageError = (error: unknown) => error instanceof ApiError && error.status === 401
  ? 'Your session has expired. Please sign in again to continue chatting.'
  : error instanceof Error ? error.message : 'Unable to reach your conversation. Please try again.';

export function MatchChat({ userId, match, onBack, draft, onDraftChange, onReviewProperty }: {
  userId: string; match: MatchConnection; onBack: () => void;
  draft: string; onDraftChange: (text: string) => void;
  onReviewProperty: (propertyId: string) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [sendError, setSendError] = useState('');
  const [locked, setLocked] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [awayFromBottom, setAwayFromBottom] = useState(false);
  const cursor = useRef(0);
  const sendingRef = useRef(false);
  const mounted = useRef(true);
  const stickToBottom = useRef(true);
  const scrollArea = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const { person } = match;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      let retry = true;
      try {
        const next = await pollMessages(
          offset => getMessages(match.id, 100, offset), cursor.current,
          batch => { if (batch.length) setMessages(previous => mergeMessages(previous, batch)); },
          () => active,
        );
        if (active) { cursor.current = next; setHistoryError(''); setLocked(false); }
      } catch (err) {
        if (active) { setHistoryError(messageError(err)); setLocked(isLocked(err)); retry = !isLocked(err); }
      } finally {
        if (active) { setLoading(false); if (retry) timer = setTimeout(poll, 3000); }
      }
    }
    void poll();
    return () => { active = false; clearTimeout(timer); };
  }, [match.id, refresh]);

  useEffect(() => {
    if (stickToBottom.current && scrollArea.current) scrollArea.current.scrollTop = scrollArea.current.scrollHeight;
  }, [messages.length, loading]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || content.length > 2000 || sendingRef.current || locked) return;
    sendingRef.current = true; setSending(true); setSendError('');
    try {
      const message = await sendMessage(match.id, content);
      onDraftChange('');
      if (!mounted.current) return;
      stickToBottom.current = true;
      setAwayFromBottom(false);
      setMessages(previous => mergeMessages(previous, [message]));
    } catch (err) {
      if (mounted.current) { setSendError(messageError(err)); if (isLocked(err)) setLocked(true); }
    } finally {
      sendingRef.current = false;
      if (mounted.current) { setSending(false); requestAnimationFrame(() => composer.current?.focus()); }
    }
  }

  return <main className="match-chat">
    <header className="chat-header">
      <button className="connection-icon-button" aria-label="Back to matches" onClick={onBack}><span className="material-symbols-outlined" aria-hidden="true">arrow_back</span></button>
      <ConnectionAvatar name={person.name} url={person.avatarUrl || person.photos[0]?.url} />
      <div><h1>{person.name}</h1><p>{person.locationCity} · {person.matchScore}% fit</p></div>
      <span className="material-symbols-outlined chat-mutual" aria-label="Mutual connection">favorite</span>
    </header>
    <div className="chat-history" ref={scrollArea} onScroll={() => {
      const area = scrollArea.current;
      if (!area) return;
      const away = area.scrollHeight - area.scrollTop - area.clientHeight > 80;
      stickToBottom.current = !away; setAwayFromBottom(away);
    }}>
      <div className="chat-beginning"><span className="material-symbols-outlined" aria-hidden="true">home</span><h2>A shared yes. Start here.</h2>
        <p>You both chose to connect. Talk spaces, routines, and what feels like home.</p></div>
      {person.propertyId && <div className="chat-property-reviews"><p>Connected or visited the property?</p><button type="button" className="connection-secondary" onClick={() => onReviewProperty(person.propertyId!)}><span className="material-symbols-outlined" aria-hidden="true">rate_review</span>Property reviews & photos</button></div>}
      {loading && <p className="connections-caption" role="status">Opening your conversation…</p>}
      {!loading && !historyError && messages.length === 0 && <section className="chat-starters" aria-label="Conversation starters"><p>Skip the small talk. Try a little home talk.</p>
        {starters.map(starter => <button key={starter} disabled={sending || locked} onClick={() => { onDraftChange(starter); composer.current?.focus(); }}>{starter}<span aria-hidden="true">↗</span></button>)}
      </section>}
      <div className="chat-messages" role="log" aria-label={`Messages with ${person.name}`} aria-live="polite" aria-relevant="additions">
        {messages.map((message, index) => {
          const own = message.sender_id === userId;
          const date = new Date(message.created_at);
          const previous = messages[index - 1];
          const showDate = !previous || new Date(previous.created_at).toDateString() !== date.toDateString();
          return <div key={message.id} className="chat-message-group">
            {showDate && <p className="chat-date">{date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>}
            <article className={`chat-bubble${own ? ' chat-bubble-own' : ''}`} aria-label={`${own ? 'You' : person.name} said`}>
              <p>{message.content}</p><time dateTime={message.created_at}>{date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</time>
            </article>
          </div>;
        })}
      </div>
    </div>
    {awayFromBottom && <button className="chat-latest" onClick={() => {
      stickToBottom.current = true; setAwayFromBottom(false);
      if (scrollArea.current) scrollArea.current.scrollTop = scrollArea.current.scrollHeight;
    }}>Latest messages ↓</button>}
    {historyError && <div className="connections-error" role="alert">{historyError}
      <button className="connection-text-button" onClick={() => setRefresh(value => value + 1)}>Retry</button></div>}
    <form className="chat-composer" onSubmit={submit}>
      {sendError && <p className="connections-error" role="alert">{sendError} Your message is still below.</p>}
      <label htmlFor="chat-message">{messages.length ? 'Keep the conversation going' : `Say hello to ${person.name}`}</label>
      <div className="chat-compose-row"><textarea id="chat-message" ref={composer} rows={2} maxLength={2000} value={draft} autoFocus
        disabled={sending || locked} onChange={event => onDraftChange(event.target.value)} placeholder="A good home starts with a hello…"
        onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} />
        <button className="connection-primary chat-send" type="submit" disabled={sending || locked || !draft.trim()} aria-label={sending ? 'Sending message' : 'Send message'}>
          <span className="material-symbols-outlined" aria-hidden="true">{sending ? 'hourglass_top' : 'arrow_upward'}</span>
        </button></div>
      <div className="chat-compose-meta"><span role="status">{sending ? 'Sending…' : locked ? 'Conversation unavailable' : 'Only you and your match can chat here'}</span><span>{draft.length}/2000</span></div>
    </form>
  </main>;
}
