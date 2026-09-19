import { useEffect, useRef, useState } from 'react';
import type { DiscoveryCandidate } from '../../types/discovery';
import { ProfileHeaderCard } from './ProfileHeaderCard';
import { EditorialPhotoCard } from './EditorialPhotoCard';
import { HingePromptCard } from './HingePromptCard';
import { BentoInfoGrid } from './BentoInfoGrid';
import { StickyActionBar } from './StickyActionBar';

interface DiscoveryFeedProps {
  candidates: DiscoveryCandidate[];
  onSwipe?: (candidateId: string, direction: 'like' | 'pass', note?: string) => void | Promise<void>;
  onSendNote?: (candidateId: string, note: string) => void | Promise<void>;
}

export function DiscoveryFeed({ candidates, onSwipe, onSendNote }: DiscoveryFeedProps) {
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentText, setCommentText] = useState('');

  const candidate = candidates[0];
  useEffect(() => () => clearTimeout(timer.current), []);

  function showToast(message: string) {
    clearTimeout(timer.current);
    setFeedbackToast(message);
    timer.current = setTimeout(() => setFeedbackToast(null), 5000);
  }

  async function swipe(direction: 'like' | 'pass', note?: string) {
    if (busy.current || !candidate) return;
    busy.current = true;
    setSaving(true);
    try {
      if (note) {
        if (onSendNote) await onSendNote(candidate.id, note);
        else await onSwipe?.(candidate.id, direction, note);
      } else {
        await onSwipe?.(candidate.id, direction);
      }
      const message = note ? `Note sent to ${candidate.name}! 💬` : `${direction === 'pass' ? 'Passed on' : 'Liked'} ${candidate.name}`;
      showToast(message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return true;
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save your choice. Try again.');
      return false;
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  const handlePass = () => {
    if (!candidate) return;
    void swipe('pass');
  };

  const handleLike = () => {
    if (!candidate) return;
    void swipe('like');
  };

  const handleSendComment = async (event: React.FormEvent) => {
    event.preventDefault();
    const note = commentText.trim();
    if (!note || !candidate) return;
    if (await swipe('like', note)) {
      setCommentText('');
      setCommentModalOpen(false);
    }
  };

  if (!candidate) {
    return (
      <div style={{ padding: '120px 24px 140px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', textAlign: 'center' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '44px', color: 'var(--color-tertiary)' }}>person_search</span>
        <h3 className="font-serif" style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-on-surface)', margin: 0 }}>You&rsquo;re all caught up</h3>
        <p style={{ fontSize: '13px', margin: 0, maxWidth: '260px', color: 'var(--color-on-surface-variant)' }}>
          No more profiles right now. Head to Matches for connection requests and conversations.
        </p>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {feedbackToast && (
        <div style={{ position: 'fixed', top: '64px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(32, 27, 23, 0.92)', color: '#ffffff', padding: '8px 18px', borderRadius: 'var(--radius-full)', fontSize: '13px', fontWeight: 600, zIndex: 100, boxShadow: '0 4px 14px rgba(0,0,0,0.2)', animation: 'fadeIn 0.2s ease' }}>
          {feedbackToast}
        </div>
      )}

      <div style={{ padding: '16px 20px 140px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <ProfileHeaderCard candidate={candidate} />
        {candidate.photos[0] && <EditorialPhotoCard photo={candidate.photos[0]} onLike={() => showToast('Liked photo!')} />}
        {candidate.prompts[0] && <HingePromptCard prompt={candidate.prompts[0]} onLike={() => showToast('Liked prompt!')} />}
        {candidate.photos[1] && <EditorialPhotoCard photo={candidate.photos[1]} onLike={() => showToast('Liked photo!')} />}
        {candidate.prompts[1] && <HingePromptCard prompt={candidate.prompts[1]} onLike={() => showToast('Liked prompt!')} />}
        {candidate.prompts[2] && <HingePromptCard prompt={candidate.prompts[2]} onLike={() => showToast('Liked prompt!')} />}
        <BentoInfoGrid bento={candidate.bento} />
      </div>

      <StickyActionBar disabled={saving} onPass={handlePass} onLike={handleLike} onRespondPrompt={() => setCommentModalOpen(true)} />

      {commentModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(32, 27, 23, 0.45)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setCommentModalOpen(false)}>
          <div style={{ width: '100%', maxWidth: '480px', background: 'var(--color-surface-container-lowest)', borderTopLeftRadius: 'var(--radius-2xl)', borderTopRightRadius: 'var(--radius-2xl)', padding: '24px 20px 32px', boxShadow: '0 -4px 20px rgba(0,0,0,0.15)' }} onClick={event => event.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 className="font-serif" style={{ fontSize: '20px', margin: 0, fontWeight: 600 }}>Respond to {candidate.name}</h3>
                <p style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)', margin: '2px 0 0' }}>Break the ice with a thoughtful roommate note.</p>
              </div>
              <button type="button" onClick={() => setCommentModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--color-on-surface-variant)', padding: '4px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>close</span>
              </button>
            </div>

            <form onSubmit={handleSendComment}>
              <textarea rows={3} maxLength={2000} placeholder="Love your coffee beans rule! I make a mean pour-over too..." value={commentText} onChange={event => setCommentText(event.target.value)} autoFocus required style={{ marginBottom: '14px' }} />
              <button type="submit" disabled={saving || !commentText.trim()} style={{ width: '100%', height: '48px', borderRadius: 'var(--radius-full)', background: 'var(--color-primary)', color: '#ffffff', fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: 'var(--shadow-warm)' }}>
                <span>Send Note & Connect</span>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>send</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
