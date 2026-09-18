import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import type { DiscoveryCandidate } from '../../types/discovery';
import { ProfileHeaderCard } from './ProfileHeaderCard';
import { EditorialPhotoCard } from './EditorialPhotoCard';
import { HingePromptCard } from './HingePromptCard';
import { BentoInfoGrid } from './BentoInfoGrid';
import { StickyActionBar } from './StickyActionBar';

interface DiscoveryFeedProps {
  candidates: DiscoveryCandidate[];
  onSwipe?: (candidateId: string, direction: 'like' | 'pass') => void;
}

export const DiscoveryFeed: React.FC<DiscoveryFeedProps> = ({
  candidates,
  onSwipe,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentText, setCommentText] = useState('');

  const candidate = candidates[currentIndex % candidates.length];

  const showToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => {
      setFeedbackToast(null);
    }, 2200);
  };

  const handlePass = () => {
    onSwipe?.(candidate.id, 'pass');
    showToast(`Passed on ${candidate.name}`);
    setCurrentIndex((prev) => (prev + 1) % candidates.length);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLike = () => {
    onSwipe?.(candidate.id, 'like');
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.85 },
      colors: ['#923326', '#2a6a48', '#ffdad4', '#aceec4'],
    });
    showToast(`Liked ${candidate.name}! ❤️`);
    setCurrentIndex((prev) => (prev + 1) % candidates.length);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSendComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.7 },
      colors: ['#923326', '#b24a3b', '#2a6a48'],
    });
    showToast(`Comment sent to ${candidate.name}! 💬`);
    setCommentText('');
    setCommentModalOpen(false);
    setCurrentIndex((prev) => (prev + 1) % candidates.length);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Toast Notification */}
      {feedbackToast && (
        <div
          style={{
            position: 'fixed',
            top: '64px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(32, 27, 23, 0.92)',
            color: '#ffffff',
            padding: '8px 18px',
            borderRadius: 'var(--radius-full)',
            fontSize: '13px',
            fontWeight: 600,
            zIndex: 100,
            boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          {feedbackToast}
        </div>
      )}

      {/* Main Feed Container */}
      <div
        style={{
          padding: '16px 20px 140px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {/* 1. Profile Header Card */}
        <ProfileHeaderCard candidate={candidate} />

        {/* 2. Photo 1 (Sunlight on Jefferson St) */}
        {candidate.photos[0] && (
          <EditorialPhotoCard photo={candidate.photos[0]} onLike={() => showToast(`Liked photo!`)} />
        )}

        {/* 3. Prompt Card 1 (Non-negotiable rule) */}
        {candidate.prompts[0] && (
          <HingePromptCard prompt={candidate.prompts[0]} onLike={() => showToast(`Liked prompt!`)} />
        )}

        {/* 4. Photo 2 (Common room vibes) */}
        {candidate.photos[1] && (
          <EditorialPhotoCard photo={candidate.photos[1]} onLike={() => showToast(`Liked photo!`)} />
        )}

        {/* 5. Prompt Card 2 (Sunday mornings) */}
        {candidate.prompts[1] && (
          <HingePromptCard prompt={candidate.prompts[1]} onLike={() => showToast(`Liked prompt!`)} />
        )}

        {/* 6. Prompt Card 3 (Budget & cost philosophy) */}
        {candidate.prompts[2] && (
          <HingePromptCard prompt={candidate.prompts[2]} onLike={() => showToast(`Liked prompt!`)} />
        )}

        {/* 7. Bento Info Grid (Desired Area & Move-in Date) */}
        <BentoInfoGrid bento={candidate.bento} />
      </div>

      {/* Sticky Floating Action Bar */}
      <StickyActionBar
        onPass={handlePass}
        onLike={handleLike}
        onRespondPrompt={() => setCommentModalOpen(true)}
      />

      {/* Respond to Prompt Modal */}
      {commentModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(32, 27, 23, 0.45)',
            backdropFilter: 'blur(4px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
          onClick={() => setCommentModalOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              background: 'var(--color-surface-container-lowest)',
              borderTopLeftRadius: 'var(--radius-2xl)',
              borderTopRightRadius: 'var(--radius-2xl)',
              padding: '24px 20px 32px',
              boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
              }}
            >
              <div>
                <h3 className="font-serif" style={{ fontSize: '20px', margin: 0, fontWeight: 600 }}>
                  Respond to {candidate.name}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)', margin: '2px 0 0' }}>
                  Break the ice with a thoughtful roommate note.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCommentModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-on-surface-variant)',
                  padding: '4px',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
                  close
                </span>
              </button>
            </div>

            <form onSubmit={handleSendComment}>
              <textarea
                rows={3}
                placeholder="Love your coffee beans rule! I make a mean pour-over too..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                autoFocus
                required
                style={{ marginBottom: '14px' }}
              />

              <button
                type="submit"
                style={{
                  width: '100%',
                  height: '48px',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--color-primary)',
                  color: '#ffffff',
                  fontSize: '15px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: 'var(--shadow-warm)',
                }}
              >
                <span>Send Note & Connect</span>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  send
                </span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
