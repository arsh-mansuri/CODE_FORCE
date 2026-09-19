import { useEffect, useRef, useState } from 'react';
import type { PropertyReview, PropertyReviewFeed, ReviewSort } from '../../types/reviews';
import { deletePropertyReview, getPropertyReviews, getStoredToken, mediaUrl, setReviewHelpful } from '../../lib/api';
import { ReviewComposer } from './ReviewComposer';
import { ReviewIcon as Icon, ReviewImage } from './ReviewImage';
import './ReviewsPage.css';

const experienceLabels = { connected: 'Connected with provider', visited: 'Visited the property', lived_here: 'Lived here' };

function ReviewStory({ review, onVote, busy }: { review: PropertyReview; onVote: (review: PropertyReview) => void; busy: boolean }) {
  return <article className="review-story">
    <div className="review-author-row"><span className="review-author-avatar"><ReviewImage src={mediaUrl(review.author_avatar)} alt={review.author_name} person /></span>
      <div><h4>{review.author_name}{review.is_mine ? ' · You' : ''}</h4><p><time dateTime={review.created_at}>{new Date(review.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</time></p></div>
      <span className="review-story-rating" aria-label={`${review.rating} out of 5 stars`}><Icon name="star" />{review.rating}</span></div>
    <div className="review-experience"><Icon name="handshake" /><span>Matched reviewer · {experienceLabels[review.experience]}</span></div>
    <blockquote>“{review.content}”</blockquote>
    {review.photos.length > 0 && <div className="review-published-photos">{review.photos.map((photo, index) => <a href={mediaUrl(photo.url)} target="_blank" rel="noreferrer" key={photo.id}
      aria-label={`Open ${review.author_name}’s review photo ${index + 1} in a new tab`}><ReviewImage src={mediaUrl(photo.thumbnail_url)} alt={`Property review photo ${index + 1} by ${review.author_name}`} /></a>)}</div>}
    <div className="review-story-actions">{review.is_mine ? <span>{review.helpful_count} found this helpful</span>
      : <button type="button" aria-pressed={review.helpful_by_me} disabled={busy} className="review-helpful" onClick={() => onVote(review)}><Icon name="thumb_up" />Helpful{review.helpful_count > 0 ? ` · ${review.helpful_count}` : ''}</button>}</div>
  </article>;
}

interface PropertyReviewsProps {
  listingId: string;
  preview?: boolean;
  onChanged?: () => void;
}

export function PropertyReviews(props: PropertyReviewsProps) {
  return <PropertyReviewContent key={props.listingId} {...props} />;
}

function PropertyReviewContent({ listingId, preview = false, onChanged }: PropertyReviewsProps) {
  const demo = Boolean(getStoredToken()?.startsWith('offline_demo_'));
  const [feed, setFeed] = useState<PropertyReviewFeed | null>(null);
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState<ReviewSort>('recent');
  const [pages, setPages] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [expanded, setExpanded] = useState(!preview);
  const [writing, setWriting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const busyRef = useRef(false);
  const editorButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (demo) return;
    let active = true;
    async function load() {
      setLoading(true); setError('');
      try {
        let result = await getPropertyReviews(listingId, sort);
        if (!active) return;
        const items = [...result.items];
        for (let page = 1; page < pages && result.next_offset !== null; page++) {
          result = await getPropertyReviews(listingId, sort, result.next_offset);
          if (!active) return;
          items.push(...result.items);
        }
        setFeed({ ...result, items: [...new Map(items.map(review => [review.id, review])).values()] });
      } catch (err) { if (active) setError(err instanceof Error ? err.message : 'Unable to load property reviews.'); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [listingId, sort, pages, refresh, demo]);

  function published(review: PropertyReview) {
    setFeed(previous => previous ? { ...previous, can_review: false, own_review_id: review.id } : previous);
    setWriting(false); setStatus('Your review and photographs are published.');
    setSort('recent'); setPages(1); setRefresh(value => value + 1); onChanged?.();
    requestAnimationFrame(() => editorButton.current?.focus());
  }

  async function vote(review: PropertyReview) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setActionError('');
    try { await setReviewHelpful(review.id, !review.helpful_by_me); setRefresh(value => value + 1); }
    catch (err) { setActionError(err instanceof Error ? err.message : 'Unable to save your helpful vote.'); }
    finally { busyRef.current = false; setBusy(false); }
  }

  async function removeReview() {
    if (!feed?.own_review_id || busyRef.current) return;
    busyRef.current = true; setBusy(true); setActionError('');
    try {
      await deletePropertyReview(feed.own_review_id); setConfirmDelete(false);
      setStatus('Your review and photographs have been removed.'); setPages(1); setRefresh(value => value + 1); onChanged?.();
    } catch (err) { setActionError(err instanceof Error ? err.message : 'Unable to remove your review.'); }
    finally { busyRef.current = false; setBusy(false); }
  }

  const stories = expanded ? feed?.items : feed?.highlights;
  return <section className={`property-reviews${preview ? ' property-reviews-preview' : ''}${!expanded ? ' property-reviews-condensed' : ''}`} aria-label={preview ? 'Property review highlights' : 'Complete property reviews'}>
    <div className="review-stories-heading"><div><p className="reviews-section-kicker">{expanded ? 'THE FULL PICTURE, FROM MATCHED MEMBERS' : 'RECENT & HELPFUL · FROM MATCHED MEMBERS'}</p>
      <h3>{expanded ? 'The inside word' : 'Before you decide'}<span>{feed?.total ?? '—'}</span></h3></div>
      {feed?.average_rating != null && <span className="review-average"><Icon name="star" /><strong>{feed.average_rating.toFixed(1)}</strong><small>/ 5</small></span>}</div>
    {demo && <p className="review-eligibility">Sign in when the server is available to read and publish shared property reviews.</p>}
    {feed && <>
      {!expanded && feed.total > 0 && <p className="review-preview-explainer">The newest review and the most helpful other review. Read the full history for every perspective.</p>}
      <div className="review-controls">
        {feed.can_review && !writing && <button ref={editorButton} type="button" className="review-primary" onClick={() => { setWriting(true); setStatus(''); }}><Icon name="edit_square" />Write a review</button>}
        {expanded && feed.total > 1 && <label className="review-sort">Sort reviews<select aria-label="Sort reviews" value={sort} disabled={loading} onChange={event => { setSort(event.target.value as ReviewSort); setPages(1); }}><option value="recent">Most recent</option><option value="helpful">Most helpful</option></select></label>}
      </div>
      {!feed.can_review && <p className="review-eligibility">{feed.eligibility_message}</p>}
      {feed.own_review_id && <div className="review-remove-row">{confirmDelete ? <><span>Remove your review and its photos?</span><button type="button" className="review-text-button" disabled={busy} onClick={() => void removeReview()}>Yes, remove</button><button type="button" className="review-text-button" disabled={busy} onClick={() => setConfirmDelete(false)}>Keep review</button></>
        : <button ref={editorButton} type="button" className="review-text-button" onClick={() => setConfirmDelete(true)}>Remove my review</button>}</div>}
    </>}
    {writing && feed?.can_review && <ReviewComposer listingId={listingId} onPublished={published} onCancel={() => { setWriting(false); editorButton.current?.focus(); }} />}
    <p className="review-save-status" role="status">{status}</p>
    {actionError && <p className="review-error" role="alert">{actionError}</p>}
    {loading && <p className="review-eligibility" role="status">Loading property reviews…</p>}
    {error && <div className="reviews-notice" role="alert"><p>{error}</p><button type="button" className="review-text-button" onClick={() => setRefresh(value => value + 1)}>Retry reviews <Icon name="refresh" /></button></div>}
    {stories?.map(review => <ReviewStory review={review} key={review.id} onVote={review => void vote(review)} busy={busy || loading} />)}
    {feed?.total === 0 && !loading && !error && !writing && <div className="review-no-stories"><Icon name="chat_bubble" /><h4>Be the first to share the inside word.</h4><p>Connected, toured the property, or lived here? Share what the next person should know.</p></div>}
    {expanded && feed?.has_more && <button type="button" className="review-text-button" disabled={loading} onClick={() => setPages(value => value + 1)}>Load older reviews <Icon name="expand_more" /></button>}
    {preview && Boolean(feed?.total) && <button type="button" className="review-chat-link" onClick={() => { setExpanded(value => !value); setPages(1); }}><span>{expanded ? 'Back to review highlights' : `Read all ${feed?.total} property reviews`}</span><Icon name={expanded ? 'expand_less' : 'arrow_forward'} /></button>}
  </section>;
}
