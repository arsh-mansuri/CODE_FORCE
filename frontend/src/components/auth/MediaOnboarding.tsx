import { useState } from 'react';
import confetti from 'canvas-confetti';
import type { MediaResponse, UserProfile } from '../../types/auth';
import { saveUser } from '../../lib/api';
import { MediaUploader } from './MediaUploader';
import { StepHeader } from './StepHeader';
import { PropertyPublicationNotice } from '../PropertyPublicationNotice';

interface MediaStep { target: 'profile' | 'property'; kind: 'photos' | 'video'; title: string; description: string }

export function MediaOnboarding({ user, onFinish, onLogout, onUserUpdate, editing = false }: {
  user: UserProfile; onFinish: (user: UserProfile) => void; onLogout: () => void; editing?: boolean;
  onUserUpdate?: (user: UserProfile) => void;
}) {
  const [draft, setDraft] = useState(user);
  const [busy, setBusy] = useState(false);
  const steps: MediaStep[] = [
    ...(user.offering ? [
      { target: 'property' as const, kind: 'photos' as const, title: 'Let’s see your place.', description: 'Your property entry is already created. Add 3–6 photos of the space to publish it automatically in Curated Flats. Photos are checked for faces; keep portraits in your profile gallery.' },
      { target: 'property' as const, kind: 'video' as const, title: 'Give them a little tour.', description: 'An optional 60-second walkthrough can make your home feel a little more real.' },
    ] : []),
    { target: 'profile', kind: 'photos', title: 'Put a face to your vibe.', description: 'Add 3–6 photos that feel like you. These stay in your personal profile gallery, separate from property images.' },
    { target: 'profile', kind: 'video', title: 'A little hello?', description: 'An optional introduction, in your own words. Tell your future housemate what feels like home.' },
  ];
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const gallery = step.target === 'profile' ? draft.media : draft.offering!.media;
  const canContinue = !busy && (step.kind === 'video' || gallery.ready);

  function update(response: MediaResponse) {
    const next: UserProfile = {
      ...draft, onboarding: response.onboarding,
      ...(response.target === 'profile' ? { media: response.gallery } : { offering: { ...draft.offering!, media: response.gallery } }),
    };
    setDraft(next);
    saveUser(next);
    onUserUpdate?.(next);
  }

  function next() {
    if (!canContinue) return;
    if (index < steps.length - 1) { setIndex(index + 1); return; }
    if (!draft.onboarding.complete) {
      setIndex(Math.max(0, steps.findIndex(item => item.kind === 'photos' && !(item.target === 'property' ? draft.offering?.media.ready : draft.media.ready))));
      return;
    }
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) void confetti({ particleCount: 65, spread: 60, colors: ['#923326', '#2a6a48', '#ffdad4'] });
    onFinish(draft);
  }

  return <div className="flow-page media-onboarding">
    {editing && <button type="button" className="secondary-button" disabled={busy} onClick={() => onFinish(draft)}>Save & return</button>}
    {draft.offering && <PropertyPublicationNotice offering={draft.offering} status={draft.onboarding.listing_status} />}
    <div className="flow-progress"><div><span>Make it yours</span><span>{index + 1} / {steps.length}</span></div><progress value={index + 1} max={steps.length} aria-label="Media setup progress" /></div>
    <div className="flow-content" key={`${step.target}-${step.kind}`}>
      <StepHeader title={step.title} description={step.description} icon={step.kind === 'photos' ? 'photo_camera' : 'videocam'} />
      <MediaUploader target={step.target} kind={step.kind} gallery={gallery} onUpdate={update} onBusyChange={setBusy} />
    </div>
    <footer className="flow-actions">
      <div className="flow-action-row">
        {index > 0 && <button type="button" className="secondary-button" disabled={busy} onClick={() => setIndex(index - 1)}>Back</button>}
        <button type="button" className="primary-button" disabled={!canContinue} onClick={next}>{index === steps.length - 1 ? 'Finish & find my people' : step.kind === 'video' && !gallery.video ? 'Skip for now' : 'Continue'}<span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span></button>
      </div>
      <p className="input-hint">Your uploads are saved as you go.</p>
      <button type="button" className="text-button" disabled={busy} onClick={onLogout}>Save & sign out</button>
    </footer>
  </div>;
}
