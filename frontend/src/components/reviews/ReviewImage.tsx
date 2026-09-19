import { useState } from 'react';

export function ReviewIcon({ name }: { name: string }) {
  return <span className="material-symbols-outlined" aria-hidden="true">{name}</span>;
}

export function ReviewImage({ src, alt, person = false }: { src?: string; alt: string; person?: boolean }) {
  const [failed, setFailed] = useState<string>();
  return <span className={`review-image${person ? ' review-image-person' : ''}`}>
    {src && failed !== src ? <img src={src} alt={alt} loading="lazy" onError={() => setFailed(src)} />
      : <span className="review-image-fallback" role="img" aria-label={alt || (person ? 'Profile photo unavailable' : 'Property photo unavailable')}><ReviewIcon name={person ? 'person' : 'cottage'} /></span>}
  </span>;
}
