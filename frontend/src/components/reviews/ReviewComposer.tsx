import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { PropertyReview, ReviewExperience } from '../../types/reviews';
import { createPropertyReview } from '../../lib/api';
import { ReviewIcon as Icon } from './ReviewImage';

function PendingPhoto({ file, onRemove }: { file: File; onRemove: () => void }) {
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const next = URL.createObjectURL(file);
    if (image.current) image.current.src = next;
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return <div className="review-pending-photo"><img ref={image} alt={`Selected review photo: ${file.name}`} />
    <button type="button" onClick={onRemove} aria-label={`Remove ${file.name}`}><Icon name="close" /></button></div>;
}

export function ReviewComposer({ listingId, onPublished, onCancel }: {
  listingId: string; onPublished: (review: PropertyReview) => void; onCancel: () => void;
}) {
  const id = useId();
  const [content, setContent] = useState('');
  const [rating, setRating] = useState(0);
  const [experience, setExperience] = useState<ReviewExperience>('connected');
  const [photos, setPhotos] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy.current || !rating || content.trim().length < 10) return;
    busy.current = true; setSending(true); setError('');
    try { onPublished(await createPropertyReview(listingId, { rating, experience, content, photos })); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to publish your review. Please try again.'); }
    finally { busy.current = false; setSending(false); }
  }

  function addPhotos(files: FileList | null) {
    const additions = Array.from(files || []);
    if (photos.length + additions.length > 6) { setError('Choose up to six photographs.'); return; }
    if (additions.some(file => file.size > 10 * 1024 * 1024)) { setError('Each photo must be 10 MiB or smaller.'); return; }
    if (additions.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) { setError('Choose JPEG, PNG, or WebP photographs.'); return; }
    setError(''); setPhotos(previous => [...previous, ...additions]);
  }

  return <form className="review-composer" onSubmit={event => void submit(event)}>
    <fieldset disabled={sending}>
      <legend>Tell us about your experience</legend>
      <div className="review-rating-input" role="radiogroup" aria-label="Your rating">
        {[1, 2, 3, 4, 5].map(value => <label key={value} className={value <= rating ? 'is-filled' : ''}>
          <input type="radio" name={`${id}-rating`} value={value} checked={rating === value} onChange={() => setRating(value)} required aria-label={`${value} ${value === 1 ? 'star' : 'stars'}`} />
          <Icon name="star" /></label>)}
        <span>{rating ? `${rating} / 5` : 'Choose a rating'}</span>
      </div>
      <label htmlFor={`${id}-experience`}>How do you know this property?</label>
      <select id={`${id}-experience`} value={experience} onChange={event => setExperience(event.target.value as ReviewExperience)}>
        <option value="connected">I connected with the provider</option><option value="visited">I visited the property</option><option value="lived_here">I lived here</option>
      </select>
      <label htmlFor={`${id}-text`}>Your review</label>
      <textarea id={`${id}-text`} value={content} onChange={event => setContent(event.target.value)} minLength={10} maxLength={3000} required rows={4}
        placeholder="How was the place, the conversation, or your visit? Share what would help someone decide." />
      <div className="review-upload-heading"><label htmlFor={`${id}-photos`}><Icon name="add_a_photo" />Add photographs</label><span>{photos.length}/6 · optional</span></div>
      <input id={`${id}-photos`} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => { addPhotos(event.target.files); event.target.value = ''; }} />
      <p>JPEG, PNG or WebP · up to 10 MiB each · minimum 160 × 160 px.</p>
      {photos.length > 0 && <div className="review-pending-photos">{photos.map((file, index) => <PendingPhoto key={`${file.name}-${file.lastModified}-${index}`} file={file} onRemove={() => setPhotos(previous => previous.filter((_, i) => i !== index))} />)}</div>}
      <p className="review-public-note"><Icon name="visibility" />Your review and photographs will be visible to other PropVibe members. Visit and stay details are self-reported.</p>
      {error && <p className="review-error" role="alert">{error}</p>}
      <div className="review-composer-actions"><button type="button" className="review-text-button" onClick={onCancel}>Cancel</button>
        <button className="review-primary" type="submit" disabled={!rating || content.trim().length < 10}>{sending ? 'Publishing…' : 'Publish review'}<Icon name="arrow_forward" /></button></div>
    </fieldset>
  </form>;
}
