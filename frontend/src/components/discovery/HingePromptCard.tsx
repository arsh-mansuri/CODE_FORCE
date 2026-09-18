import React, { useState } from 'react';
import type { PromptCardData } from '../../types/discovery';

interface HingePromptCardProps {
  prompt: PromptCardData;
  onLike?: (promptId: string) => void;
  readOnly?: boolean;
}

export const HingePromptCard: React.FC<HingePromptCardProps> = ({ prompt, onLike, readOnly = false }) => {
  const [liked, setLiked] = useState(false);

  const handleLikeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLiked(!liked);
    onLike?.(prompt.id);
  };

  return (
    <div
      style={{
        position: 'relative',
        background: 'var(--color-surface-container-lowest)',
        border: '1px solid var(--color-outline-variant)',
        borderRadius: 'var(--radius-xl)',
        padding: '20px 18px 22px',
        boxShadow: '0 2px 8px rgba(32, 27, 23, 0.04)',
      }}
    >
      {/* Category Prompt Label */}
      <div
        style={{
          fontSize: '11px',
          fontWeight: 700,
          color: 'var(--color-on-surface-variant)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          marginBottom: '8px',
        }}
      >
        {prompt.label}
      </div>

      {/* Editorial Serif Quote */}
      <blockquote
        className="font-serif"
        style={{
          fontSize: '20px',
          lineHeight: '28px',
          fontWeight: 500,
          color: 'var(--color-on-surface)',
          letterSpacing: '-0.01em',
          margin: readOnly ? 0 : '0 36px 0 0',
          overflowWrap: 'anywhere',
          whiteSpace: 'pre-wrap',
        }}
      >
        “{prompt.text}”
      </blockquote>

      {/* Floating Like Button */}
      {!readOnly && <button
        type="button"
        onClick={handleLikeClick}
        style={{
          position: 'absolute',
          bottom: '16px',
          right: '16px',
          width: '38px',
          height: '38px',
          borderRadius: '50%',
          background: 'var(--color-surface-bright)',
          border: liked ? '1.5px solid var(--color-primary)' : '1px solid var(--color-outline-variant)',
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
        aria-label={`Like answer to ${prompt.label}`}
      >
        <span
          className={`material-symbols-outlined ${liked ? 'filled' : ''}`}
          style={{
            fontSize: '19px',
            color: 'var(--color-primary)',
            transition: 'transform 0.15s ease',
            transform: liked ? 'scale(1.15)' : 'scale(1)',
          }}
        >
          favorite
        </span>
      </button>}
    </div>
  );
};
