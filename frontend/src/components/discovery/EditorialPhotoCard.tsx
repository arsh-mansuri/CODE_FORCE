import React, { useState } from 'react';
import type { PhotoCardData } from '../../types/discovery';

interface EditorialPhotoCardProps {
  photo: PhotoCardData;
  onLike?: (photoId: string) => void;
  readOnly?: boolean;
}

export const EditorialPhotoCard: React.FC<EditorialPhotoCardProps> = ({ photo, onLike, readOnly = false }) => {
  const [liked, setLiked] = useState(false);

  const handleLikeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLiked(!liked);
    onLike?.(photo.id);
  };

  const isLandscape = photo.aspectRatio === 'landscape';

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 'var(--radius-xl)',
        overflow: 'hidden',
        border: '1px solid var(--color-outline-variant)',
        boxShadow: '0 2px 8px rgba(32, 27, 23, 0.05)',
        width: '100%',
        aspectRatio: isLandscape ? '16 / 10' : '4 / 5',
        background: 'var(--color-surface-container-low)',
      }}
    >
      <img
        src={photo.url}
        alt={photo.tag}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
        loading="lazy"
      />

      {/* Subtle bottom gradient overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(0, 0, 0, 0.35) 0%, transparent 40%)',
          pointerEvents: 'none',
        }}
      />

      {/* Bottom-left frosted glass label */}
      <div
        style={{
          position: 'absolute',
          bottom: '12px',
          left: '12px',
          background: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(221, 192, 187, 0.6)',
          borderRadius: 'var(--radius-full)',
          padding: '4px 12px',
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--color-on-surface)',
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
        }}
      >
        {photo.tag}
      </div>

      {/* Bottom-right floating like button */}
      {!readOnly && <button
        type="button"
        onClick={handleLikeClick}
        style={{
          position: 'absolute',
          bottom: '12px',
          right: '12px',
          width: '42px',
          height: '42px',
          borderRadius: '50%',
          background: 'var(--color-surface-container-lowest)',
          border: '1px solid var(--color-outline-variant)',
          boxShadow: '0 3px 10px rgba(0, 0, 0, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: liked ? 'var(--color-primary)' : 'var(--color-primary)',
          cursor: 'pointer',
        }}
        aria-label={`Like photo ${photo.tag}`}
      >
        <span
          className={`material-symbols-outlined ${liked ? 'filled' : ''}`}
          style={{
            fontSize: '20px',
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
