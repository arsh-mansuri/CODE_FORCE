import React from 'react';
import type { DiscoveryCandidate } from '../../types/discovery';

interface ProfileHeaderCardProps {
  candidate: DiscoveryCandidate;
}

export const ProfileHeaderCard: React.FC<ProfileHeaderCardProps> = ({ candidate }) => {
  return (
    <div
      style={{
        background: 'var(--color-surface-container-lowest)',
        border: '1px solid rgba(221, 192, 187, 0.45)',
        borderRadius: 'var(--radius-xl)',
        padding: '18px 16px',
        boxShadow: '0 2px 8px rgba(32, 27, 23, 0.03)',
      }}
    >
      {/* Top Header Row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '12px',
          marginBottom: '12px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <h2
              className="font-serif"
              style={{
                fontSize: '26px',
                fontWeight: 600,
                color: 'var(--color-on-surface)',
                letterSpacing: '-0.01em',
                margin: 0,
              }}
            >
              {candidate.name}, {candidate.age}
            </h2>
            {candidate.verified && (
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: '19px',
                  color: 'var(--color-secondary)',
                  verticalAlign: 'middle',
                }}
              >
                verified_user
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: '13.5px',
              color: 'var(--color-on-surface-variant)',
              marginTop: '4px',
              lineHeight: '1.35',
              fontWeight: 400,
              maxWidth: '220px',
            }}
          >
            {candidate.subtitle}
          </div>
        </div>

        {/* Compatibility Match Pill */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(216, 243, 227, 0.7)',
            color: 'var(--color-secondary)',
            padding: '5px 12px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid rgba(42, 106, 72, 0.22)',
            flexShrink: 0,
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: '15px', color: 'var(--color-secondary)' }}
          >
            favorite
          </span>
          <div style={{ textAlign: 'left', lineHeight: '1.05' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, display: 'block' }}>
              {candidate.matchScore}%
            </span>
            <span style={{ fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.02em' }}>
              Match
            </span>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div
        style={{
          height: '1px',
          background: 'rgba(221, 192, 187, 0.4)',
          marginBottom: '14px',
        }}
      />

      {/* Lifestyle Chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {candidate.chips.map((chip, idx) => {
          if (chip.isBudget) {
            return (
              <span
                key={idx}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-full)',
                  background: 'rgba(178, 74, 59, 0.06)',
                  border: '1px solid rgba(178, 74, 59, 0.35)',
                  color: 'var(--color-primary)',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--color-primary)' }}>
                  payments
                </span>
                <span>{chip.label}</span>
              </span>
            );
          }

          if (chip.icon === 'cleaning_services') {
            return (
              <span
                key={idx}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-full)',
                  background: 'rgba(42, 106, 72, 0.06)',
                  border: '1px solid rgba(42, 106, 72, 0.28)',
                  color: 'var(--color-secondary)',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--color-secondary)' }}>
                  eco
                </span>
                <span>{chip.label}</span>
              </span>
            );
          }

          if (chip.icon === 'wb_sunny') {
            return (
              <span
                key={idx}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-full)',
                  background: 'rgba(178, 74, 59, 0.04)',
                  border: '1px solid rgba(178, 74, 59, 0.2)',
                  color: 'var(--color-on-surface)',
                  fontSize: '12px',
                  fontWeight: 500,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--color-primary)' }}>
                  light_mode
                </span>
                <span>{chip.label}</span>
              </span>
            );
          }

          return (
            <span
              key={idx}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--color-surface-container-low)',
                border: '1px solid var(--color-outline-variant)',
                color: 'var(--color-on-surface)',
                fontSize: '12px',
                fontWeight: 500,
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: '14px',
                  color: 'var(--color-on-surface-variant)',
                }}
              >
                {chip.icon}
              </span>
              <span>{chip.label}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
};
