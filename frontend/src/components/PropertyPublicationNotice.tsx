import type { ListingPublicationStatus, ListingView } from '../types/auth';
import { mediaUrl } from '../lib/api';
import './PropertyPublicationNotice.css';

export function PropertyPublicationNotice({ offering, status, onManagePhotos }: {
  offering: ListingView;
  status?: ListingPublicationStatus | null;
  onManagePhotos?: () => void;
}) {
  const publication = status ?? (!offering.is_active ? 'paused' : offering.media.ready ? 'published' : 'needs_photos');
  const cover = mediaUrl(offering.media.cover_photo_url);
  const needed = Math.max(0, offering.media.minimum_photos - offering.media.photo_count);
  return <section className="property-publication" aria-label="Your automatic property listing">
    {cover && <img className="property-publication__cover" src={cover} alt={offering.title} />}
    <div className="property-publication__content">
      <p className="property-publication__status" role="status">
        <span className="material-symbols-outlined" aria-hidden="true">{publication === 'published' ? 'check_circle' : publication === 'paused' ? 'pause_circle' : 'add_photo_alternate'}</span>
        {publication === 'published' ? 'Live in Curated Flats' : publication === 'paused' ? 'Property listing paused' : 'Your property entry is ready for photos'}
      </p>
      <h3>{offering.title}</h3>
      <p>{offering.location.area}, {offering.location.city} · ₹{offering.monthly_rent.toLocaleString('en-IN')}/month</p>
      <p>{publication === 'published'
        ? 'Eligible home seekers can see your property photos and saved listing details. Profile edits update this same entry automatically.'
        : publication === 'paused'
          ? 'Reopen your offering in Edit / complete profile when you are ready to list it again.'
          : `Created automatically from your profile details. Add ${needed} more property photo${needed === 1 ? '' : 's'} to appear in Curated Flats. Your first property photo is the cover.`}</p>
      {onManagePhotos && <button type="button" className="secondary-button" onClick={onManagePhotos}>Manage property photos</button>}
    </div>
  </section>;
}
