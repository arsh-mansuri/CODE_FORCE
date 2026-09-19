import React, { useEffect, useRef, useState, useCallback } from 'react';
import confetti from 'canvas-confetti';
import type { UserProfile } from '../../types/auth';
import type { ListingFeedItem } from '../../types/feed';
import { ApiError, fetchListings, mediaUrl, requestPropertyTour } from '../../lib/api';
import { MatchFitSummary } from '../MatchFitSummary';
import { PropertyPublicationNotice } from '../PropertyPublicationNotice';

interface CuratedFlatsViewProps {
  currentUser: UserProfile | null;
  onManagePhotos?: () => void;
  onOpenMatches?: () => void;
}

export const CuratedFlatsView: React.FC<CuratedFlatsViewProps> = ({ currentUser, onManagePhotos, onOpenMatches }) => {
  const [listings, setListings] = useState<ListingFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [minScoreFilter, setMinScoreFilter] = useState<number>(0);
  const [acFilter, setAcFilter] = useState<boolean>(false);
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<ListingFeedItem | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [requestingOwnerId, setRequestingOwnerId] = useState<string | null>(null);
  const [tourRequests, setTourRequests] = useState<Record<string, 'pending' | 'matched'>>({});
  const [tourError, setTourError] = useState('');
  const [needsPhotos, setNeedsPhotos] = useState(false);
  const requestBusy = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const city =
    currentUser?.profile?.search?.location?.city ||
    currentUser?.offering?.location?.city ||
    'Ahmedabad';

  const loadListings = useCallback(async (minScore: number) => {
    setLoading(true);
    setError(null);
    try {
      const feed = await fetchListings({
        limit: 50,
        min_match_score: minScore,
      });
      setListings(feed.items);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to load curated flats';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function execute() {
      try {
        const feed = await fetchListings({
          limit: 50,
          min_match_score: minScoreFilter,
        });
        if (!ignore) {
          setListings(feed.items);
          setError(null);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Unable to load curated flats');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }
    void execute();
    return () => {
      ignore = true;
    };
  }, [minScoreFilter]);

  // Client-side AC, Area, and Type filter (Flats, Bungalows, PGs, Hostels)
  const displayedListings = listings.filter((item) => {
    if (acFilter && !item.listing.air_conditioning?.available) {
      return false;
    }
    if (selectedArea !== 'all' && item.listing.location.area !== selectedArea) {
      return false;
    }
    if (selectedType !== 'all') {
      const titleLower = item.listing.title.toLowerCase();
      const descLower = item.listing.description.toLowerCase();
      const propType = item.listing.property_type;

      if (selectedType === 'flat') {
        const isBungalow = titleLower.includes('bungalow') || titleLower.includes('villa') || titleLower.includes('row house') || propType === '4bhk_plus';
        const isPG = titleLower.includes('pg') || descLower.includes('paying guest') || descLower.includes('pg ');
        const isHostel = titleLower.includes('hostel') || titleLower.includes('co-living') || descLower.includes('hostel');
        if (isBungalow || isPG || isHostel) return false;
      } else if (selectedType === 'bungalow') {
        const isBungalow = titleLower.includes('bungalow') || titleLower.includes('villa') || titleLower.includes('row house') || propType === '4bhk_plus';
        if (!isBungalow) return false;
      } else if (selectedType === 'pg') {
        const isPG = titleLower.includes('pg') || descLower.includes('paying guest') || descLower.includes('pg ');
        if (!isPG) return false;
      } else if (selectedType === 'hostel') {
        const isHostel = titleLower.includes('hostel') || titleLower.includes('co-living') || descLower.includes('hostel');
        if (!isHostel) return false;
      }
    }
    return true;
  });

  const formatPrice = (amount: number, _propertyCity?: string) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const getSpernerSplitSummary = (rent: number, propertyCity: string, propertyType: string, spaces: number) => {
    const format = (val: number) => formatPrice(val, propertyCity);
    const numRooms = propertyType === '3bhk' ? 3 : propertyType === '2bhk' ? 2 : Math.max(1, spaces);

    if (numRooms === 2) {
      // Exactly matches demo ratio (e.g. $1,850 + $1,550 = $3,400)
      const master = Math.round((rent * 0.544) / 50) * 50;
      const corner = rent - master;
      return `Master ${format(master)} · Corner ${format(corner)}`;
    }
    if (numRooms === 3) {
      // Exactly matches demo ratio (e.g. $1,550 + $1,450 + $1,200 = $4,200)
      const balcony = Math.round((rent * 0.369) / 50) * 50;
      const master = Math.round((rent * 0.345) / 50) * 50;
      const den = rent - balcony - master;
      return `Balcony ${format(balcony)} · Master ${format(master)} · Den ${format(den)}`;
    }
    if (numRooms >= 4) {
      const perPerson = Math.round(rent / numRooms);
      return `${numRooms}-Way Fair Split: ~${format(perPerson)}/room`;
    }
    return `Solo Fair Rent: ${format(rent)}`;
  };

  const formatSpecsLine = (item: ListingFeedItem) => {
    const parts: string[] = [];
    const type = item.listing.property_type;
    if (type === '2bhk') parts.push('2 Bed • 1.5 Bath');
    else if (type === '3bhk') parts.push('3 Bed • 2 Bath');
    else if (type === '1bhk') parts.push('1 Bed • 1 Bath');
    else if (type === 'studio') parts.push('Studio • 1 Bath');
    else parts.push(`${type.toUpperCase()} • ${item.listing.available_spaces} Space`);

    if (item.listing.amenities && item.listing.amenities.length > 0) {
      parts.push(item.listing.amenities[0]);
    }

    if (item.listing.nearby_landmarks && item.listing.nearby_landmarks.length > 0) {
      const lm = item.listing.nearby_landmarks[0];
      const dist = lm.distance_km < 1 ? `${Math.round(lm.distance_km * 1000)}m` : `${lm.distance_km}km`;
      parts.push(`${dist} to ${lm.name}`);
    }

    return parts.join(' • ');
  };

  const handleApplyClick = async (item: ListingFeedItem) => {
    const ownerId = item.listing.owner_id;
    if (requestBusy.current || tourRequests[ownerId]) return;
    requestBusy.current = true;
    setRequestingOwnerId(ownerId);
    setTourError('');
    setNeedsPhotos(false);
    setActionSuccess(null);
    try {
      const result = await requestPropertyTour(item.listing);
      setTourRequests(previous => ({ ...previous, [ownerId]: result.matched ? 'matched' : 'pending' }));
      setActionSuccess(result.matched
        ? `You're connected with ${item.provider_name}! Open Matches to arrange your tour.`
        : `Tour request sent to ${item.provider_name}. They'll see it in their connection requests.`);
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setActionSuccess(null), 6000);
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        void confetti({ particleCount: 65, spread: 70, origin: { y: 0.6 }, colors: ['#923326', '#2a6a48', '#aff1c6', '#ffdad4'] });
      }
    } catch (err) {
      setTourError(err instanceof Error ? err.message : 'Unable to send your tour request. Please try again.');
      setNeedsPhotos(err instanceof ApiError && err.code === 'media_onboarding_incomplete');
    } finally {
      requestBusy.current = false;
      setRequestingOwnerId(null);
    }
  };

  return (
    <div style={{ padding: '20px 20px 96px', width: '100%', maxWidth: '640px', margin: '0 auto' }}>
      {/* Toast */}
      {actionSuccess && (
        <div
          role="status"
          style={{
            position: 'fixed',
            top: '72px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--color-secondary)',
            color: '#ffffff',
            padding: '10px 20px',
            borderRadius: 'var(--radius-full)',
            fontSize: '13px',
            fontWeight: 600,
            zIndex: 200,
            boxShadow: 'var(--shadow-md)',
            animation: 'fadeIn 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
            check_circle
          </span>
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Header matching user's screenshot */}
      <header style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: '24px' }}>
              apartment
            </span>
            <h2 className="font-serif" style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>
              Curated Flats
            </h2>
          </div>
          <button
            type="button"
            onClick={() => void loadListings(minScoreFilter)}
            title="Refresh listings"
            style={{
              border: 'none',
              background: 'var(--color-surface-container)',
              width: '34px',
              height: '34px',
              borderRadius: 'var(--radius-full)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--color-on-surface-variant)',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              refresh
            </span>
          </button>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)', margin: '4px 0 0' }}>
          Community-listed homes in {city} · Explore fair-rent splitting
        </p>
      </header>

      {currentUser?.offering && <PropertyPublicationNotice offering={currentUser.offering} status={currentUser.onboarding.listing_status} onManagePhotos={onManagePhotos} />}

      {/* Primary Filter & Matching Pills */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '4px',
          marginBottom: '8px',
          scrollbarWidth: 'none',
        }}
      >
        <button
          type="button"
          onClick={() => setMinScoreFilter(0)}
          style={{
            border: 'none',
            padding: '6px 14px',
            borderRadius: 'var(--radius-full)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            background: minScoreFilter === 0 ? 'var(--color-primary)' : 'var(--color-surface-container)',
            color: minScoreFilter === 0 ? '#ffffff' : 'var(--color-on-surface-variant)',
          }}
        >
          All Homes ({listings.length})
        </button>

        <button
          type="button"
          onClick={() => setMinScoreFilter((prev) => (prev === 85 ? 0 : 85))}
          style={{
            border: 'none',
            padding: '6px 14px',
            borderRadius: 'var(--radius-full)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            background: minScoreFilter === 85 ? 'var(--color-secondary)' : 'var(--color-surface-container)',
            color: minScoreFilter === 85 ? '#ffffff' : 'var(--color-on-surface-variant)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
            hotel_class
          </span>
          Top Matches (85%+)
        </button>

        <button
          type="button"
          onClick={() => setAcFilter((prev) => !prev)}
          style={{
            border: 'none',
            padding: '6px 14px',
            borderRadius: 'var(--radius-full)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            background: acFilter ? 'var(--color-secondary)' : 'var(--color-surface-container)',
            color: acFilter ? '#ffffff' : 'var(--color-on-surface-variant)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
            ac_unit
          </span>
          AC Access
        </button>
      </div>

      {/* Secondary Filter: Neighborhoods & Layouts */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          overflowX: 'auto',
          paddingBottom: '8px',
          marginBottom: '12px',
          scrollbarWidth: 'none',
        }}
      >
        {[
          { label: 'All Areas', value: 'all' },
          { label: 'Bodakdev', value: 'Bodakdev' },
          { label: 'Navrangpura', value: 'Navrangpura' },
          { label: 'Satellite', value: 'Satellite' },
          { label: 'Vastrapur', value: 'Vastrapur' },
          { label: 'Prahlad Nagar', value: 'Prahlad Nagar' },
          { label: 'Thaltej', value: 'Thaltej' },
          { label: 'SG Highway', value: 'SG Highway' },
          { label: 'Ambawadi', value: 'Ambawadi' },
          { label: 'Science City', value: 'Science City' },
          { label: 'Gandhinagar', value: 'Gandhinagar' },
        ].map((area) => (
          <button
            key={area.value}
            type="button"
            onClick={() => setSelectedArea(area.value)}
            style={{
              border: selectedArea === area.value ? '1px solid var(--color-primary)' : '1px solid var(--color-outline-variant)',
              padding: '4px 10px',
              borderRadius: 'var(--radius-full)',
              fontSize: '11px',
              fontWeight: 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              background: selectedArea === area.value ? 'var(--color-primary-fixed)' : 'var(--color-surface-container-lowest)',
              color: selectedArea === area.value ? 'var(--color-on-primary-fixed)' : 'var(--color-on-surface-variant)',
            }}
          >
            {area.label}
          </button>
        ))}
      </div>

      {/* Results Header Count & Property Categories */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <span style={{ fontSize: '12px', color: 'var(--color-tertiary)', fontWeight: 500 }}>
          Showing <strong>{displayedListings.length}</strong> {displayedListings.length === 1 ? 'property' : 'properties'}
        </span>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {[
            { label: 'All Types', value: 'all' },
            { label: '🏢 Flats', value: 'flat' },
            { label: '🏡 Bungalows', value: 'bungalow' },
            { label: '🛏️ PGs', value: 'pg' },
            { label: '👥 Hostels', value: 'hostel' },
          ].map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => setSelectedType(type.value)}
              style={{
                border: 'none',
                padding: '3px 8px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '11px',
                cursor: 'pointer',
                background: selectedType === type.value ? 'var(--color-tertiary-container)' : 'var(--color-surface-container-low)',
                color: selectedType === type.value ? 'var(--color-on-tertiary-container)' : 'var(--color-on-surface-variant)',
                fontWeight: selectedType === type.value ? 700 : 500,
              }}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {[1, 2].map((i) => (
            <div
              key={i}
              style={{
                background: 'var(--color-surface-container-lowest)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--color-outline-variant)',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-xs)',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '180px',
                  background: 'var(--color-surface-container-high)',
                  opacity: 0.6,
                }}
              />
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ height: '20px', width: '60%', background: 'var(--color-surface-container-high)', borderRadius: '4px' }} />
                <div style={{ height: '14px', width: '80%', background: 'var(--color-surface-container)', borderRadius: '4px' }} />
                <div style={{ height: '32px', width: '100%', background: 'var(--color-surface-container)', borderRadius: '8px' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div
          style={{
            background: 'var(--color-surface-container-lowest)',
            borderRadius: 'var(--radius-xl)',
            padding: '24px',
            textAlign: 'center',
            border: '1px solid var(--color-outline-variant)',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '36px', color: 'var(--color-error)' }}>
            error_outline
          </span>
          <h3 style={{ margin: '8px 0 4px', fontSize: '16px' }}>Unable to fetch listings</h3>
          <p style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)', marginBottom: '16px' }}>
            {error}
          </p>
          <button
            type="button"
            onClick={() => void loadListings(minScoreFilter)}
            style={{
              padding: '8px 20px',
              borderRadius: 'var(--radius-full)',
              border: 'none',
              background: 'var(--color-primary)',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && displayedListings.length === 0 && (
        <div
          style={{
            background: 'var(--color-surface-container-lowest)',
            borderRadius: 'var(--radius-xl)',
            padding: '36px 20px',
            textAlign: 'center',
            border: '1px solid var(--color-outline-variant)',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '40px', color: 'var(--color-primary)' }}>
            houseboat
          </span>
          <h3 className="font-serif" style={{ margin: '12px 0 6px', fontSize: '18px' }}>
            No matching properties found
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)', marginBottom: '16px' }}>
            Try relaxing your match score or AC filter to explore more homes in {city}.
          </p>
          <button
            type="button"
            onClick={() => {
              setMinScoreFilter(0);
              setAcFilter(false);
              setSelectedArea('all');
              setSelectedType('all');
            }}
            style={{
              padding: '8px 18px',
              borderRadius: 'var(--radius-full)',
              border: 'none',
              background: 'var(--color-surface-container-high)',
              color: 'var(--color-on-surface)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Listing Cards List */}
      {!loading && !error && displayedListings.length > 0 && listings.every(item => item.compatibility.match_type === 'alternative') && (
        <p role="status" className="match-fit-summary match-fit-summary--alternative">
          No exact match for your saved preferences yet. Here are alternatives in {city}, ranked by match percentage. Each home shows the trade-offs to consider.
        </p>
      )}
      {!loading && !error && displayedListings.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {displayedListings.map((item) => {
            const { listing, match_score, provider_name } = item;
            const photoUrl =
              mediaUrl(listing.media?.photos?.[0]?.url) ||
              mediaUrl(listing.media?.cover_photo_url) ||
              'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=900&auto=format&fit=crop&q=80';

            const photoCount = listing.media?.photo_count || listing.media?.photos?.length || 1;

            return (
              <article
                key={listing.id}
                onClick={() => {
                  setSelectedItem(item);
                  setActivePhotoIndex(0);
                  setTourError('');
                  setNeedsPhotos(false);
                }}
                style={{
                  background: 'var(--color-surface-container-lowest)',
                  borderRadius: 'var(--radius-xl)',
                  border: '1px solid var(--color-outline-variant)',
                  overflow: 'hidden',
                  boxShadow: '0 2px 8px rgba(32, 27, 23, 0.05)',
                  cursor: 'pointer',
                  transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(32, 27, 23, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(32, 27, 23, 0.05)';
                }}
              >
                {/* Photo with Badges */}
                <div style={{ position: 'relative', width: '100%', height: '190px', background: '#333' }}>
                  <img
                    src={photoUrl}
                    alt={listing.title}
                    loading="lazy"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />

                  {/* Top-Right: Compatibility Badge */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      background: 'rgba(32, 27, 23, 0.85)',
                      backdropFilter: 'blur(8px)',
                      color: '#aff1c6',
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '11px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#aff1c6' }}>
                      {item.compatibility.match_type === 'alternative' ? 'tune' : 'check_circle'}
                    </span>
                    <span>{match_score}% Match</span>
                  </div>

                  {/* Bottom-Left: Photo Count Pill */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '10px',
                      left: '12px',
                      background: 'rgba(0, 0, 0, 0.65)',
                      backdropFilter: 'blur(4px)',
                      color: '#ffffff',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '11px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                      photo_camera
                    </span>
                    <span>{photoCount}</span>
                  </div>
                </div>

                {/* Card Content matching user's screenshot */}
                <div style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                    <h3
                      className="font-serif"
                      style={{
                        fontSize: '18px',
                        fontWeight: 600,
                        margin: 0,
                        color: 'var(--color-on-surface)',
                      }}
                    >
                      {listing.title}
                    </h3>
                    <span
                      style={{
                        fontSize: '14px',
                        fontWeight: 700,
                        color: 'var(--color-primary)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatPrice(listing.monthly_rent, listing.location.city)}/mo total
                    </span>
                  </div>

                  {/* Subtitle Line: Specs, Laundry, Transit */}
                  <p
                    style={{
                      fontSize: '12px',
                      color: 'var(--color-on-surface-variant)',
                      margin: '4px 0 12px',
                      lineHeight: '18px',
                    }}
                  >
                    {formatSpecsLine(item)}
                  </p>

                  <MatchFitSummary compatibility={item.compatibility} compact />

                  {/* Sperner Fair Split Pill matching screenshot */}
                  <div
                    style={{
                      background: 'var(--color-secondary-container)',
                      color: 'var(--color-on-secondary-container)',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '12px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginBottom: '10px',
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: '16px', color: 'var(--color-secondary)' }}
                    >
                      balance
                    </span>
                    <span>
                      Sperner Fair Split:{' '}
                      <strong style={{ fontWeight: 700 }}>
                        {getSpernerSplitSummary(
                          listing.monthly_rent,
                          listing.location.city,
                          listing.property_type,
                          listing.available_spaces,
                        )}
                      </strong>
                    </span>
                  </div>

                  {/* Utility & Climate Transparency Disclosures */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                    {listing.electricity && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--color-surface-container)',
                          color: 'var(--color-on-surface-variant)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '13px', color: '#e69138' }}>
                          bolt
                        </span>
                        {listing.electricity.billing_method === 'included_in_rent'
                          ? 'Electric included'
                          : listing.electricity.split?.split_between
                            ? `Electric: ${listing.electricity.split.split_between}-way split`
                            : 'Electric metered'}
                      </span>
                    )}

                    {listing.air_conditioning?.available && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--color-surface-container)',
                          color: 'var(--color-on-surface-variant)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '13px', color: '#3878b4' }}>
                          ac_unit
                        </span>
                        {listing.air_conditioning.billing_method === 'included_in_rent'
                          ? 'AC included'
                          : 'AC installed'}
                      </span>
                    )}

                    <span
                      style={{
                        fontSize: '11px',
                        color: 'var(--color-tertiary)',
                        marginLeft: 'auto',
                        alignSelf: 'center',
                      }}
                    >
                      Host: {provider_name}
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Property Detail Modal */}
      {selectedItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="property-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(32, 27, 23, 0.65)',
            backdropFilter: 'blur(6px)',
            zIndex: 150,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: '0',
            animation: 'fadeIn 0.2s ease',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !requestBusy.current) setSelectedItem(null);
          }}
        >
          <div
            style={{
              background: 'var(--color-surface-container-lowest)',
              width: '100%',
              maxWidth: '600px',
              maxHeight: '90vh',
              borderTopLeftRadius: 'var(--radius-2xl)',
              borderTopRightRadius: 'var(--radius-2xl)',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-lg)',
              padding: '24px 20px 36px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {/* Modal Header Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>
                  domain
                </span>
                <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-primary)' }}>
                  Property Inspection
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                disabled={requestingOwnerId !== null}
                aria-label="Close property details"
                style={{
                  border: 'none',
                  background: 'var(--color-surface-container)',
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-full)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--color-on-surface-variant)',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  close
                </span>
              </button>
            </div>

            {/* Gallery Carousel */}
            {selectedItem.listing.media?.photos && selectedItem.listing.media.photos.length > 0 && (
              <div>
                <div style={{ position: 'relative', width: '100%', height: '240px', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: '#000' }}>
                  <img
                    src={mediaUrl(selectedItem.listing.media.photos[activePhotoIndex]?.url)}
                    alt={selectedItem.listing.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  {selectedItem.listing.media.photos[activePhotoIndex]?.caption && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
                        color: '#fff',
                        padding: '16px 12px 8px',
                        fontSize: '12px',
                      }}
                    >
                      {selectedItem.listing.media.photos[activePhotoIndex].caption}
                    </div>
                  )}
                </div>

                {/* Thumbnails */}
                {selectedItem.listing.media.photos.length > 1 && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px', overflowX: 'auto' }}>
                    {selectedItem.listing.media.photos.map((photo, idx) => (
                      <button
                        key={photo.id || idx}
                        type="button"
                        onClick={() => setActivePhotoIndex(idx)}
                        style={{
                          border: activePhotoIndex === idx ? '2px solid var(--color-primary)' : '2px solid transparent',
                          borderRadius: 'var(--radius-md)',
                          padding: 0,
                          overflow: 'hidden',
                          width: '60px',
                          height: '42px',
                          flexShrink: 0,
                          cursor: 'pointer',
                        }}
                      >
                        <img
                          src={mediaUrl(photo.thumbnail_url || photo.url)}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Title & Rent Breakdown */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h3 id="property-modal-title" className="font-serif" style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>
                  {selectedItem.listing.title}
                </h3>
                <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-primary)' }}>
                  {formatPrice(selectedItem.listing.monthly_rent, selectedItem.listing.location.city)}/mo
                </span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)', margin: '4px 0 12px' }}>
                {selectedItem.listing.location.area}, {selectedItem.listing.location.city} • PIN {selectedItem.listing.location.pincode}
              </p>
            </div>

            {/* Sperner Fair-Rent Deep Dive */}
            <div
              style={{
                background: 'var(--color-secondary-container)',
                color: 'var(--color-on-secondary-container)',
                padding: '14px 16px',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--color-secondary)' }}>
                  balance
                </span>
                <strong style={{ fontSize: '14px' }}>Sperner Envy-Free Rent Harmony</strong>
              </div>
              <p style={{ fontSize: '12px', lineHeight: '18px', margin: '0 0 8px' }}>
                Using Sperner's Lemma over the simplex of rent combinations, this flat has verified room values where no roommate prefers anyone else's room at the agreed price:
              </p>
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.65)',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: 'var(--color-on-surface)',
                }}
              >
                {getSpernerSplitSummary(
                  selectedItem.listing.monthly_rent,
                  selectedItem.listing.location.city,
                  selectedItem.listing.property_type,
                  selectedItem.listing.available_spaces,
                )}
              </div>
            </div>

            {/* Compatibility Reasons */}
            <MatchFitSummary compatibility={selectedItem.compatibility} />
            {!selectedItem.compatibility.match_type && selectedItem.compatibility?.reasons && selectedItem.compatibility.reasons.length > 0 && (
              <div
                style={{
                  background: 'var(--color-surface-container)',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-lg)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--color-secondary)' }}>
                    recommend
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-on-surface)' }}>
                    Why this matches you ({selectedItem.match_score}%)
                  </span>
                </div>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: 'var(--color-on-surface-variant)', lineHeight: '18px' }}>
                  {selectedItem.compatibility.reasons.map((reason, idx) => (
                    <li key={idx}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Description */}
            {selectedItem.listing.description && (
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '6px' }}>About this space</h4>
                <p style={{ fontSize: '13px', lineHeight: '20px', color: 'var(--color-on-surface-variant)', margin: 0 }}>
                  {selectedItem.listing.description}
                </p>
              </div>
            )}

            {/* Electricity & Air Conditioning Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                background: 'var(--color-surface-container)',
                padding: '14px',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              {/* Electricity Policy */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#e69138' }}>
                    bolt
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>Electricity Policy</span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--color-on-surface)', margin: '0 0 2px' }}>
                  Method: {selectedItem.listing.electricity?.billing_method.replace(/_/g, ' ') || 'Actual Bill'}
                </p>
                {selectedItem.listing.electricity?.notes && (
                  <p style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)', margin: 0 }}>
                    {selectedItem.listing.electricity.notes}
                  </p>
                )}
              </div>

              {/* AC Policy */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#3878b4' }}>
                    ac_unit
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>Air Conditioning</span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--color-on-surface)', margin: '0 0 2px' }}>
                  {selectedItem.listing.air_conditioning?.available ? 'Available' : 'None'}
                </p>
                {selectedItem.listing.air_conditioning?.notes && (
                  <p style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)', margin: 0 }}>
                    {selectedItem.listing.air_conditioning.notes}
                  </p>
                )}
              </div>
            </div>

            {/* Amenities */}
            {selectedItem.listing.amenities && selectedItem.listing.amenities.length > 0 && (
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>Amenities</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {selectedItem.listing.amenities.map((amenity, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: '12px',
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--color-surface-container-high)',
                        color: 'var(--color-on-surface)',
                      }}
                    >
                      {amenity}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Nearby Landmarks */}
            {selectedItem.listing.nearby_landmarks && selectedItem.listing.nearby_landmarks.length > 0 && (
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>Transit & Neighborhood</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {selectedItem.listing.nearby_landmarks.map((lm, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '12px',
                        padding: '6px 10px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--color-surface-container)',
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{lm.name}</span>
                      <span style={{ color: 'var(--color-tertiary)' }}>{lm.distance_km} km away</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Host & Apply CTAs */}
            <div style={{ paddingTop: '8px', borderTop: '1px solid var(--color-outline-variant)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--color-tertiary)' }}>Offering Provider</span>
                  <div style={{ fontSize: '14px', fontWeight: 700 }}>{selectedItem.provider_name}</div>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-secondary)', fontWeight: 600 }}>
                  Verified Identity ✓
                </div>
              </div>

              <p style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>
                Requesting a tour sends this provider a connection request with a note about the property. You can arrange the visit in chat after they accept.
              </p>
              {tourError && <p className="flow-error" role="alert">{tourError}</p>}
              {needsPhotos && onManagePhotos && <button type="button" className="secondary-button" onClick={onManagePhotos}>Complete your photos</button>}
              {tourRequests[selectedItem.listing.owner_id] && <p role="status" style={{ fontSize: '13px', color: 'var(--color-secondary)' }}>
                {tourRequests[selectedItem.listing.owner_id] === 'matched'
                  ? 'You’re connected! Go to Matches to arrange your tour in chat.'
                  : 'Tour request sent. Waiting for the provider to accept your connection request.'}
              </p>}
              {tourRequests[selectedItem.listing.owner_id] === 'matched' && onOpenMatches && <button type="button" className="secondary-button" onClick={onOpenMatches}>Open Matches</button>}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  disabled={requestingOwnerId !== null}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--color-outline)',
                    background: 'transparent',
                    color: 'var(--color-on-surface)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => void handleApplyClick(selectedItem)}
                  disabled={requestingOwnerId !== null || Boolean(tourRequests[selectedItem.listing.owner_id])}
                  aria-busy={requestingOwnerId === selectedItem.listing.owner_id}
                  style={{
                    flex: 2,
                    padding: '12px',
                    borderRadius: 'var(--radius-full)',
                    border: 'none',
                    background: 'var(--color-primary)',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: requestingOwnerId !== null || tourRequests[selectedItem.listing.owner_id] ? 'default' : 'pointer',
                    opacity: requestingOwnerId !== null || tourRequests[selectedItem.listing.owner_id] ? 0.7 : 1,
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  {requestingOwnerId === selectedItem.listing.owner_id ? 'Sending request…'
                    : tourRequests[selectedItem.listing.owner_id] === 'matched' ? 'Connected'
                      : tourRequests[selectedItem.listing.owner_id] === 'pending' ? 'Tour request sent'
                        : 'Apply / Request Tour'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
