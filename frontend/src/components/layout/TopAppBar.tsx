import React from 'react';

interface TopAppBarProps {
  city?: string;
  area?: string;
  onFilterClick?: () => void;
}

export const TopAppBar: React.FC<TopAppBarProps> = ({
  city = 'Brooklyn, NY',
  area = 'Bushwick',
  onFilterClick,
}) => {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        height: '56px',
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(255, 248, 245, 0.94)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(221, 192, 187, 0.4)',
      }}
    >
      {/* Location Left */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{
            fontSize: '20px',
            color: 'var(--color-primary)',
          }}
        >
          near_me
        </span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span
            className="font-serif"
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--color-on-surface)',
              letterSpacing: '-0.01em',
            }}
          >
            {city}
          </span>
          {area && (
            <span
              style={{
                fontSize: '13px',
                color: 'var(--color-on-surface-variant)',
                fontWeight: 500,
              }}
            >
              • {area}
            </span>
          )}
        </div>
      </div>

      {/* Filter Right */}
      <button
        type="button"
        onClick={onFilterClick}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--color-on-surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '6px',
          borderRadius: '50%',
        }}
        aria-label="Filter discovery options"
      >
        <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
          tune
        </span>
      </button>
    </header>
  );
};
