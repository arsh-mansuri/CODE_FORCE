import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import type { UserProfile } from '../../types/auth';
import type { MatchConnection } from '../../types/connections';
import { mediaUrl } from '../../lib/api';
import { ConnectionAvatar } from './ConnectionAvatar';
import './Connections.css';

export function MatchCelebration({ user, match, onMessage, onLater }: {
  user: UserProfile; match: MatchConnection; onMessage: () => void; onLater: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { person } = match;
  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    element?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      void confetti({ particleCount: 90, spread: 75, origin: { y: 0.55 }, colors: ['#923326', '#2a6a48', '#ffdad4', '#aceec4'] });
    }
    return () => { element?.close(); document.body.style.overflow = overflow; previousFocus?.focus(); };
  }, []);

  return <dialog className="match-celebration" ref={dialog} aria-labelledby="match-title" aria-describedby="match-description"
    onCancel={event => { event.preventDefault(); onLater(); }}>
    <button className="connection-icon-button celebration-close" aria-label="Keep discovering" onClick={onLater}><span aria-hidden="true">×</span></button>
    <p className="connections-eyebrow">A little chemistry. A lot of possibility.</p>
    <div className="match-portraits">
      <ConnectionAvatar large name={user.profile.full_name} url={mediaUrl(user.media.cover_photo_url || user.media.photos[0]?.url)} />
      <span className="match-heart" aria-hidden="true">♥</span>
      <ConnectionAvatar large name={person.name} url={person.avatarUrl || person.photos[0]?.url} />
    </div>
    <p className="connection-fit">{person.matchScore}% housing & lifestyle fit</p>
    <h1 id="match-title">You’re a match.</h1>
    <p id="match-description">You and <strong>{person.name}</strong> both chose to connect. Your next chapter could start with a hello.</p>
    <div className="match-first-note"><span className="material-symbols-outlined" aria-hidden="true">chat_bubble</span><p>Make the first move.<br /><strong>Ask about their ideal place to call home.</strong></p></div>
    <button className="connection-primary" autoFocus onClick={onMessage}>Send a message <span aria-hidden="true">↗</span></button>
    <button className="connection-text-button" onClick={onLater}>I’ll say hello later</button>
    <p className="connections-caption">Your conversation is waiting in Matches.</p>
  </dialog>;
}
