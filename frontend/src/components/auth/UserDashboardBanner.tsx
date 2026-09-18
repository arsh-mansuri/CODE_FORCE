import React from 'react';
import type { UserProfile } from '../../types/auth';
import { clearSession } from '../../lib/api';

interface UserDashboardBannerProps {
  user: UserProfile;
  onLogout: () => void;
  onSwitchPersona: () => void;
}

export const UserDashboardBanner: React.FC<UserDashboardBannerProps> = ({
  user,
  onLogout,
  onSwitchPersona,
}) => {
  const profile = user.profile;
  const avatar =
    user.media.photos[0]?.url ||
    user.media.cover_photo_url ||
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80';

  const handleLogoutClick = () => {
    clearSession();
    onLogout();
  };

  return (
    <div style={{ padding: '20px' }}>
      {/* Editorial Header */}
      <div
        style={{
          background: 'var(--color-surface-container-lowest)',
          border: '1px solid var(--color-outline-variant)',
          borderRadius: 'var(--radius-xl)',
          padding: '20px',
          boxShadow: 'var(--shadow-sm)',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
          <img
            src={avatar}
            alt={profile.full_name}
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              objectFit: 'cover',
              border: '2px solid var(--color-primary)',
              padding: '2px',
            }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <h2
                className="font-serif"
                style={{
                  fontSize: '22px',
                  fontWeight: 600,
                  color: 'var(--color-on-surface)',
                  margin: 0,
                }}
              >
                {profile.full_name}
              </h2>
              <span
                className="material-symbols-outlined filled"
                style={{ fontSize: '18px', color: 'var(--color-secondary)' }}
              >
                verified
              </span>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)', marginTop: '2px' }}>
              {profile.occupation || 'Co-living Explorer'} · {profile.age} yrs
            </div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                marginTop: '6px',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--color-secondary-container)',
                color: 'var(--color-on-secondary-container)',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                check_circle
              </span>
              <span>{profile.intent.replace(/_/g, ' ')}</span>
            </div>
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p
            style={{
              fontSize: '13px',
              color: 'var(--color-on-surface-variant)',
              lineHeight: '18px',
              borderTop: '1px solid var(--color-surface-container)',
              paddingTop: '12px',
              margin: '0 0 14px',
              fontStyle: 'italic',
            }}
          >
            "{profile.bio}"
          </p>
        )}

        {/* Vibe Overview Bento */}
        {profile.lifestyle && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '8px',
              marginBottom: '16px',
            }}
          >
            <div
              style={{
                background: 'var(--color-surface-container-low)',
                padding: '10px 12px',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-outline-variant)',
              }}
            >
              <span style={{ fontSize: '11px', color: 'var(--color-tertiary)', display: 'block' }}>
                Cleanliness
              </span>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>
                Level {profile.lifestyle.cleanliness}/5
              </span>
            </div>
            <div
              style={{
                background: 'var(--color-surface-container-low)',
                padding: '10px 12px',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-outline-variant)',
              }}
            >
              <span style={{ fontSize: '11px', color: 'var(--color-tertiary)', display: 'block' }}>
                Social Battery
              </span>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>
                Level {profile.lifestyle.social_energy}/5
              </span>
            </div>
            <div
              style={{
                background: 'var(--color-surface-container-low)',
                padding: '10px 12px',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-outline-variant)',
              }}
            >
              <span style={{ fontSize: '11px', color: 'var(--color-tertiary)', display: 'block' }}>
                Sleep Rhythm
              </span>
              <span style={{ fontSize: '13px', fontWeight: 600, textTransform: 'capitalize' }}>
                {profile.lifestyle.sleep_schedule.replace('_', ' ')}
              </span>
            </div>
            <div
              style={{
                background: 'var(--color-surface-container-low)',
                padding: '10px 12px',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-outline-variant)',
              }}
            >
              <span style={{ fontSize: '11px', color: 'var(--color-tertiary)', display: 'block' }}>
                Food Routine
              </span>
              <span style={{ fontSize: '13px', fontWeight: 600, textTransform: 'capitalize' }}>
                {profile.lifestyle.diet}
              </span>
            </div>
          </div>
        )}

        {/* Offering view if available */}
        {user.offering && (
          <div
            style={{
              background: 'var(--color-surface-container-low)',
              borderRadius: 'var(--radius-lg)',
              padding: '12px',
              border: '1px solid var(--color-outline-variant)',
              marginBottom: '16px',
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '4px' }}>
              ACTIVE LISTING
            </div>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>{user.offering.title}</div>
            <div style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', marginTop: '2px' }}>
              ₹{user.offering.monthly_rent.toLocaleString()}/mo · {user.offering.location.city} ({user.offering.location.area})
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={onSwitchPersona}
            style={{
              flex: 1,
              height: '42px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--color-primary-fixed)',
              color: 'var(--color-primary)',
              border: '1px solid var(--color-primary)',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              swap_horiz
            </span>
            <span>Switch Persona</span>
          </button>
          <button
            type="button"
            onClick={handleLogoutClick}
            style={{
              height: '42px',
              padding: '0 16px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--color-surface-container-lowest)',
              border: '1px solid var(--color-outline-variant)',
              color: 'var(--color-error)',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              logout
            </span>
            <span>Log Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
