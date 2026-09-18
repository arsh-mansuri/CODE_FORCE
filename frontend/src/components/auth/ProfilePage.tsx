import { useRef, useState } from 'react';
import type { MediaGallery, UserProfile } from '../../types/auth';
import type { LifestyleChipData } from '../../types/discovery';
import { getStoredToken, mediaUrl } from '../../lib/api';
import { INTENT_LABELS } from '../../lib/intents';
import { ProfileHeaderCard } from '../discovery/ProfileHeaderCard';
import { EditorialPhotoCard } from '../discovery/EditorialPhotoCard';
import { HingePromptCard } from '../discovery/HingePromptCard';
import { BentoInfoGrid } from '../discovery/BentoInfoGrid';
import { ProfileEditor } from './ProfileEditor';
import { AccountDeletionPanel } from './AccountDeletionPanel';
import './Profile.css';

interface ProfilePageProps {
  user: UserProfile;
  onUserUpdate: (user: UserProfile) => void;
  onEditMedia: () => void;
  onLogout: () => void;
}

const words = (value: string) => value.replaceAll('_', ' ');
const money = (value: number) => `₹${value.toLocaleString('en-IN')}`;
const date = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

function ProfilePhotos({ gallery, name, offset = 0 }: { gallery: MediaGallery; name: string; offset?: number }) {
  return <>{gallery.photos.map((photo, index) => <EditorialPhotoCard key={photo.id} readOnly photo={{
    id: photo.id, url: mediaUrl(photo.url), tag: photo.caption || `${name} · ${index + offset + 1}`,
    aspectRatio: photo.width > photo.height ? 'landscape' : 'portrait',
  }} />)}
    {gallery.video && <video className="profile-video" controls playsInline preload="metadata"
      src={mediaUrl(gallery.video.url)} poster={mediaUrl(gallery.video.thumbnail_url)} aria-label={`${name} video`} />}
  </>;
}

export function ProfilePage({ user, onUserUpdate, onEditMedia, onLogout }: ProfilePageProps) {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const { profile, offering } = user;
  const { search, lifestyle } = profile;
  const chips: LifestyleChipData[] = [];
  if (search) chips.push({ icon: 'payments', label: `${money(search.budget.minimum)}–${money(search.budget.maximum)}/mo`, isBudget: true });
  if (offering) chips.push({ icon: 'payments', label: `${money(offering.monthly_rent)}/mo`, isBudget: true });
  if (lifestyle) chips.push(
    { icon: 'cleaning_services', label: `Cleanliness ${lifestyle.cleanliness}/5` },
    { icon: lifestyle.sleep_schedule === 'early_bird' ? 'wb_sunny' : 'bedtime', label: words(lifestyle.sleep_schedule) },
    { icon: 'restaurant', label: words(lifestyle.diet) },
    { icon: 'work', label: words(lifestyle.work_style) },
    { icon: 'groups', label: `Social energy ${lifestyle.social_energy}/5` },
    { icon: lifestyle.smokes ? 'smoking_rooms' : 'smoke_free', label: lifestyle.smokes ? 'Smoker' : 'Non-smoker' },
    { icon: 'pets', label: lifestyle.has_pets ? 'Has pets' : 'No pets' },
  );

  function closeEditor() {
    setEditing(false);
    requestAnimationFrame(() => editButton.current?.focus());
  }

  if (editing) return <ProfileEditor user={user} onCancel={closeEditor} onSave={updated => {
    onUserUpdate(updated); setSaved(true); closeEditor();
  }} />;

  return <div className="profile-page">
    <header className="profile-toolbar profile-header">
      <div><p className="eyebrow">Your PropVibe</p><h1>Your profile</h1></div>
      <div className="profile-top-actions">
        <button ref={editButton} type="button" className="primary-button" onClick={() => { setSaved(false); setEditing(true); }}>
          <span className="material-symbols-outlined" aria-hidden="true">edit</span>Edit profile
        </button>
        <button type="button" className="secondary-button" onClick={onEditMedia}><span className="material-symbols-outlined" aria-hidden="true">photo_library</span>Manage photos & videos</button>
      </div>
    </header>
    <p className="profile-view-note"><span className="material-symbols-outlined" aria-hidden="true">visibility</span>
      A look at your profile through someone else’s eyes.
    </p>
    {saved && <p className="profile-save-notice" role="status">Profile updated{getStoredToken()?.startsWith('offline_demo_') ? ' on this device' : ''}. Looking good!</p>}
    <div className="profile-public-view" aria-label="Your public profile preview">
      <ProfileHeaderCard candidate={{ name: profile.full_name, age: profile.age, verified: false,
        subtitle: [profile.occupation, offering?.location.city || search?.location.city].filter(Boolean).join(' · '), chips }} />
      <div className="profile-goals">{(profile.intents?.length ? profile.intents : [profile.intent]).map(intent =>
        <span key={intent}>{INTENT_LABELS[intent]}</span>)}
      </div>
      {user.media.photos[0] && <EditorialPhotoCard readOnly photo={{ id: user.media.photos[0].id,
        url: mediaUrl(user.media.photos[0].url), tag: user.media.photos[0].caption || profile.full_name }} />}
      {profile.bio && <HingePromptCard readOnly prompt={{ id: 'bio', label: 'A little about me', text: profile.bio }} />}
      {!user.media.photos.length && <div className="profile-empty"><div className="preview-monogram">{profile.full_name.charAt(0)}</div><p>Your photos will appear here.</p></div>}
      {search && <BentoInfoGrid bento={{
        desiredArea: { title: search.location.areas.join(', ') || search.location.city, subtitle: search.location.city },
        moveInDate: { title: date(search.move_in_from), subtitle: `By ${date(search.move_in_by)} · ${search.stay_months} months` },
      }} />}
      <ProfilePhotos gallery={{ ...user.media, photos: user.media.photos.slice(1) }} name={profile.full_name} offset={1} />
      {offering && <section className="profile-home" aria-label="Your home listing">
        <div className="profile-detail-card"><p className="eyebrow">A place to call home</p><h2>{offering.title}</h2>
          <p>{offering.location.area}, {offering.location.city}</p>
          <p className="profile-rent">{money(offering.monthly_rent)}<small> / month</small></p>
          <p>{money(offering.deposit)} deposit · {words(offering.furnishing)} · {words(offering.property_type)}</p>
          <p>Available {date(offering.available_from)} · {offering.minimum_stay_months} month minimum stay</p>
        </div>
        {offering.description && <HingePromptCard readOnly prompt={{ id: 'home', label: 'About the home', text: offering.description }} />}
        {offering.amenities.length > 0 && <div className="profile-goals">{offering.amenities.map(amenity => <span key={amenity}>{words(amenity)}</span>)}</div>}
        <ProfilePhotos gallery={offering.media} name={offering.title} />
      </section>}
    </div>
    <footer className="profile-owner-actions">
      <p className="muted">Match scores are personal to each viewer.</p>
      <AccountDeletionPanel user={user} onUserUpdate={onUserUpdate} />
      <button type="button" className="text-button" onClick={onLogout}>Sign out</button>
    </footer>
  </div>;
}
