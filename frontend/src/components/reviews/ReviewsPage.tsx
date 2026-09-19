import { useEffect, useRef, useState } from 'react';
import type { UserProfile } from '../../types/auth';
import type { ReviewedProperty } from '../../types/reviews';
import { getReviewedProperties, getStoredToken, mediaUrl } from '../../lib/api';
import { PropertyReviews } from './PropertyReviews';
import { ReviewIcon as Icon, ReviewImage } from './ReviewImage';
import './ReviewsPage.css';

export function ReviewsPage({ user, initialPropertyId, onDiscover }: {
  user: UserProfile; initialPropertyId?: string | null; onDiscover: () => void;
}) {
  const demo = Boolean(getStoredToken()?.startsWith('offline_demo_'));
  const [properties, setProperties] = useState<ReviewedProperty[]>([]);
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [selectedId, setSelectedId] = useState(initialPropertyId || '');
  const [filter, setFilter] = useState<'all' | 'reviewed' | 'unreviewed'>('all');
  const featured = useRef<HTMLElement>(null);

  useEffect(() => {
    if (demo) return;
    let active = true;
    async function load() {
      setLoading(true); setError('');
      try { const items = await getReviewedProperties(); if (active) setProperties(items); }
      catch (err) { if (active) setError(err instanceof Error ? err.message : 'Unable to load your matched properties.'); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [demo, refresh, user.id]);

  const selected = properties.find(property => property.listing.id === selectedId) || properties[0];
  const listing = selected?.listing;
  const visible = properties.filter(property => filter === 'all' || (filter === 'reviewed' ? property.review_count > 0 : property.review_count === 0));

  function selectProperty(property: ReviewedProperty) {
    setSelectedId(property.listing.id);
    featured.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    featured.current?.focus({ preventScroll: true });
  }

  return <main className="reviews-page">
    <header className="reviews-heading"><div className="reviews-eyebrow"><span className="reviews-eyebrow-line" /> THE PLACES. THE PEOPLE. THE REAL STORIES.</div>
      <div className="reviews-title-row"><h1>Good vibes,<br /><em>backed up.</em></h1><span className="reviews-heading-seal"><Icon name="format_quote" /></span></div>
      <p>Your matched properties, their full review history,<br />and a place to share your own experience.</p></header>
    {demo && <p className="reviews-demo-note"><Icon name="cloud_off" /> Shared reviews need an online account. Sign in when the server is available.</p>}
    {loading && !properties.length && <div className="reviews-loading" role="status"><span /><p>Finding your matched properties…</p></div>}
    {error && <div className="reviews-notice" role="alert"><p>{error}</p><button className="review-text-button" onClick={() => setRefresh(value => value + 1)}>Try again <Icon name="refresh" /></button></div>}
    {selected && listing && <>
      {properties.length > 1 && <div className="review-property-picker"><label htmlFor="review-property-picker">Choose a property</label><select id="review-property-picker" value={listing.id} onChange={event => {
        const property = properties.find(item => item.listing.id === event.target.value);
        if (property) selectProperty(property);
      }}>{properties.map(property => <option value={property.listing.id} key={property.listing.id}>{property.listing.title} · {property.review_count} {property.review_count === 1 ? 'review' : 'reviews'}</option>)}</select></div>}
      <section className="review-featured" ref={featured} tabIndex={-1} aria-label={`Reviews for ${listing.title}`}>
        <div className="review-hero"><ReviewImage src={mediaUrl(listing.media.cover_photo_url || listing.media.photos[0]?.url)} alt={listing.title} /><div className="review-hero-shade" />
          <div className="review-hero-top"><span className="review-glass-pill"><Icon name={selected.is_owner ? 'home' : 'favorite'} />{selected.is_owner ? 'Your property' : selected.active_match ? 'It’s a mutual match' : 'Previously matched'}</span>
            {selected.match_score !== null && <span className="review-fit"><Icon name="auto_awesome" />{Math.round(selected.match_score)}% fit</span>}</div>
          <div className="review-hero-copy"><span className="review-hero-label">A SPACE. A STORY. A SECOND OPINION.</span><h2>{listing.title}</h2>
            <p><Icon name="location_on" />{listing.location.area}, {listing.location.city}</p><div className="review-hero-details">
              <span>{listing.property_type.replace(/(\d)bhk/, '$1 BHK').replace(/_/g, ' ')}</span><span>{listing.furnishing.replace(/_/g, ' ')}</span><span>{listing.kind.replace(/_/g, ' ')}</span></div></div>
        </div>
        <div className="review-host-row"><div className="review-host-avatar"><ReviewImage src={mediaUrl(selected.provider_avatar)} alt={selected.provider_name} person /></div>
          <div className="review-host-copy"><span>The person behind the place</span><strong>{selected.provider_name}</strong></div>
          <p className="review-rent">₹{listing.monthly_rent.toLocaleString('en-IN')}<span>/ month</span></p></div>
        <div className="review-stories"><PropertyReviews listingId={listing.id} onChanged={() => setRefresh(value => value + 1)} /></div>
      </section>
      <section className="reviews-network" aria-labelledby="reviews-network-title"><div className="reviews-network-heading"><div><p className="reviews-section-kicker">EVERY PROPERTY, ITS WHOLE STORY</p><h2 id="reviews-network-title">Your matched places<span>.</span></h2></div><span className="reviews-network-count">{properties.length.toString().padStart(2, '0')}</span></div>
        <p className="reviews-network-caption">All reviews, including those shared before you matched.</p>
        <div className="reviews-filters" aria-label="Filter properties">{([{ id: 'all', label: 'All properties' }, { id: 'reviewed', label: 'With reviews' }, { id: 'unreviewed', label: 'No reviews yet' }] as const).map(item => <button key={item.id} aria-pressed={filter === item.id} className={filter === item.id ? 'is-active' : ''} onClick={() => setFilter(item.id)}>{item.label}</button>)}</div>
        <div className="reviews-match-grid">{visible.map(property => <button className={`review-match-card${listing.id === property.listing.id ? ' is-selected' : ''}`} key={property.listing.id} aria-pressed={listing.id === property.listing.id} onClick={() => selectProperty(property)}>
          <span className="review-match-photo"><ReviewImage src={mediaUrl(property.listing.media.cover_photo_url || property.listing.media.photos[0]?.url)} alt="" /><span className="review-match-fit">{property.average_rating !== null ? `★ ${property.average_rating.toFixed(1)}` : 'New stories welcome'}</span><span className="review-match-kind"><Icon name="home" /></span></span>
          <span className="review-match-copy"><strong>{property.listing.title}</strong><span>{property.listing.location.area}, {property.listing.location.city}</span><span className="review-match-action">{property.review_count} {property.review_count === 1 ? 'review' : 'reviews'}<Icon name="arrow_outward" /></span></span></button>)}</div>
        {!visible.length && <p className="reviews-notice">No properties in this filter yet.</p>}
      </section>
    </>}
    {!selected && !loading && !error && <section className="reviews-empty"><span><Icon name="cottage" /></span><p className="reviews-section-kicker">YOUR NEXT CHAPTER STARTS HERE</p><h2>Find your people.<br /><em>Then find your home.</em></h2><p>Match with a property’s provider to see it here. Read its full review history, then share a review and photos after connecting or visiting.</p><button className="review-primary" onClick={onDiscover}>Discover your people <Icon name="arrow_forward" /></button></section>}
    <footer className="reviews-footer"><Icon name="favorite" /><span>Good homes are built on shared experiences.</span></footer>
  </main>;
}
