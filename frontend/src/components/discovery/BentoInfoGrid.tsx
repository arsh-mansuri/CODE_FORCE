import React from 'react';
import type { BentoInfoData } from '../../types/discovery';

interface BentoInfoGridProps {
  bento: BentoInfoData;
}

export const BentoInfoGrid: React.FC<BentoInfoGridProps> = ({ bento }) => {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '12px',
      }}
    >
      {/* Desired Area Cell */}
      <div
        style={{
          background: 'var(--color-surface-container-lowest)',
          border: '1px solid var(--color-outline-variant)',
          borderRadius: 'var(--radius-xl)',
          padding: '14px 16px',
          boxShadow: '0 2px 6px rgba(32, 27, 23, 0.04)',
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: '20px', color: 'var(--color-primary)' }}
        >
          location_on
        </span>
        <div
          style={{
            fontSize: '10px',
            fontWeight: 700,
            color: 'var(--color-tertiary)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginTop: '6px',
          }}
        >
          DESIRED AREA
        </div>
        <div
          style={{
            fontSize: '14px',
            fontWeight: 700,
            color: 'var(--color-on-surface)',
            marginTop: '2px',
            lineHeight: '1.2',
          }}
        >
          {bento.desiredArea.title}
        </div>
        <div
          style={{
            fontSize: '11px',
            color: 'var(--color-tertiary)',
            marginTop: '4px',
          }}
        >
          {bento.desiredArea.subtitle}
        </div>
      </div>

      {/* Move-in Date Cell */}
      <div
        style={{
          background: 'var(--color-surface-container-lowest)',
          border: '1px solid var(--color-outline-variant)',
          borderRadius: 'var(--radius-xl)',
          padding: '14px 16px',
          boxShadow: '0 2px 6px rgba(32, 27, 23, 0.04)',
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: '20px', color: 'var(--color-secondary)' }}
        >
          calendar_month
        </span>
        <div
          style={{
            fontSize: '10px',
            fontWeight: 700,
            color: 'var(--color-tertiary)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginTop: '6px',
          }}
        >
          MOVE-IN DATE
        </div>
        <div
          style={{
            fontSize: '14px',
            fontWeight: 700,
            color: 'var(--color-on-surface)',
            marginTop: '2px',
            lineHeight: '1.2',
          }}
        >
          {bento.moveInDate.title}
        </div>
        <div
          style={{
            fontSize: '11px',
            color: 'var(--color-tertiary)',
            marginTop: '4px',
          }}
        >
          {bento.moveInDate.subtitle}
        </div>
      </div>
    </div>
  );
};
