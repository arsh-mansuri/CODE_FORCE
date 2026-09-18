import React from 'react';

interface StickyActionBarProps {
  onPass: () => void;
  onLike: () => void;
  onRespondPrompt: () => void;
}

export const StickyActionBar: React.FC<StickyActionBarProps> = ({
  onPass,
  onLike,
  onRespondPrompt,
}) => {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '68px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '480px',
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 40,
        pointerEvents: 'none',
      }}
    >
      {/* Pass Button (Left) */}
      <button
        type="button"
        onClick={onPass}
        style={{
          pointerEvents: 'auto',
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          background: 'var(--color-surface-container-lowest)',
          border: '1px solid var(--color-outline-variant)',
          boxShadow: '0 4px 14px rgba(32, 27, 23, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-on-surface)',
          cursor: 'pointer',
        }}
        aria-label="Pass candidate"
      >
        <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>
          close
        </span>
      </button>

      {/* Respond to prompt (Center Pill) */}
      <button
        type="button"
        onClick={onRespondPrompt}
        style={{
          pointerEvents: 'auto',
          height: '50px',
          padding: '0 22px',
          borderRadius: 'var(--radius-full)',
          background: 'var(--color-surface-container-lowest)',
          border: '1px solid rgba(221, 192, 187, 0.8)',
          boxShadow: '0 4px 14px rgba(32, 27, 23, 0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: 'var(--color-on-surface)',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
        }}
        aria-label="Respond to prompt"
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: '18px', color: 'var(--color-primary)' }}
        >
          chat_bubble_outline
        </span>
        <span>Respond to prompt</span>
      </button>

      {/* Like Button (Right) */}
      <button
        type="button"
        onClick={onLike}
        style={{
          pointerEvents: 'auto',
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          background: 'var(--color-primary)',
          boxShadow: '0 4px 14px rgba(146, 51, 38, 0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          cursor: 'pointer',
        }}
        aria-label="Like candidate"
      >
        <span
          className="material-symbols-outlined filled"
          style={{ fontSize: '24px', color: '#ffffff' }}
        >
          favorite
        </span>
      </button>
    </div>
  );
};
