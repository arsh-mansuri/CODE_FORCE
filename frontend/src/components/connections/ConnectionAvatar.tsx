import { useState } from 'react';

export function ConnectionAvatar({ name, url, large = false }: { name: string; url?: string; large?: boolean }) {
  const [failedUrl, setFailedUrl] = useState<string>();
  return <span className={`connection-avatar${large ? ' connection-avatar-large' : ''}`}>
    {url && url !== failedUrl
      ? <img src={url} alt={name} onError={() => setFailedUrl(url)} />
      : <span aria-label={name}>{name.trim().charAt(0).toUpperCase()}</span>}
  </span>;
}
