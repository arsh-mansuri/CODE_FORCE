import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import type { DiscoveryCandidate } from '../../types/discovery';
import { ProfileHeaderCard } from './ProfileHeaderCard';
import { EditorialPhotoCard } from './EditorialPhotoCard';
import { HingePromptCard } from './HingePromptCard';
import { BentoInfoGrid } from './BentoInfoGrid';
import { StickyActionBar } from './StickyActionBar';

interface DiscoveryFeedProps {
  candidates: DiscoveryCandidate[];
  onSwipe: (candidateId: string, direction: 'like' | 'pass') => Promise<void>;
}

export function DiscoveryFeed({ candidates, onSwipe }: DiscoveryFeedProps) {
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const candidate = candidates[0];
  useEffect(() => () => clearTimeout(timer.current), []);

  function showToast(message: string) {
    clearTimeout(timer.current);
    setFeedback(message);
    timer.current = setTimeout(() => setFeedback(''), 5000);
  }

  async function swipe(direction: 'like' | 'pass') {
    if (busy.current || !candidate) return;
    busy.current = true; setSaving(true);
    try {
      await onSwipe(candidate.id, direction);
      showToast(`${direction === 'pass' ? 'Passed on' : 'Liked'} ${candidate.name}`);
      if (direction === 'like' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        void confetti({ particleCount: 50, spread: 60, origin: { y: 0.85 }, colors: ['#923326', '#2a6a48', '#ffdad4'] });
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save your choice. Try again.');
    } finally { busy.current = false; setSaving(false); }
  }

  if (!candidate) return null;
  return <div style={{ position: 'relative', width: '100%' }}>
    {feedback && <div className="discovery-toast" role="status">{feedback}</div>}
    <div className="discovery-cards" key={candidate.id}>
      <ProfileHeaderCard candidate={candidate} />
      {candidate.photos.map((photo, index) => <div className="discovery-card-pair" key={photo.id}>
        <EditorialPhotoCard photo={photo} onLike={() => void swipe('like')} />
        {candidate.prompts[index] && <HingePromptCard prompt={candidate.prompts[index]} onLike={() => void swipe('like')} />}
      </div>)}
      {candidate.prompts.slice(candidate.photos.length).map(prompt => <HingePromptCard key={prompt.id} prompt={prompt} onLike={() => void swipe('like')} />)}
      <BentoInfoGrid bento={candidate.bento} />
    </div>
    <StickyActionBar disabled={saving} onPass={() => void swipe('pass')} onLike={() => void swipe('like')}
      onRespondPrompt={() => showToast('Connect with each other first to unlock messaging.')} />
  </div>;
}
