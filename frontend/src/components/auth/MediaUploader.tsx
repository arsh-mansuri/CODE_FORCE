import { useEffect, useRef, useState } from 'react';
import type { MediaGallery, MediaResponse } from '../../types/auth';
import { deleteMedia, mediaUrl, uploadMedia } from '../../lib/api';

interface MediaUploaderProps {
  target: 'profile' | 'property';
  kind: 'photos' | 'video';
  gallery: MediaGallery;
  onUpdate: (response: MediaResponse) => void;
  onBusyChange: (busy: boolean) => void;
}

export function MediaUploader({ target, kind, gallery, onUpdate, onBusyChange }: MediaUploaderProps) {
  const [pending, setPending] = useState<{ file: File; url: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const camera = useRef<HTMLVideoElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const deviceCamera = useRef<HTMLInputElement>(null);
  const isPhoto = kind === 'photos';
  const maximum = gallery.maximum_photos || 6;

  useEffect(() => () => pending.forEach(item => URL.revokeObjectURL(item.url)), [pending]);

  useEffect(() => {
    onBusyChange(busy || pending.length > 0 || cameraOpen);
    return () => onBusyChange(false);
  }, [busy, pending.length, cameraOpen, onBusyChange]);

  useEffect(() => {
    if (!cameraOpen) return;
    let stream: MediaStream | undefined;
    let cancelled = false;
    async function startCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera capture needs HTTPS or localhost. You can use your device camera or upload a photo instead.');
        const result = await navigator.mediaDevices.getUserMedia({ audio: false, video: {
          facingMode: target === 'profile' ? 'user' : 'environment', width: { ideal: 1280 }, height: { ideal: 960 },
        } });
        if (cancelled) { result.getTracks().forEach(track => track.stop()); return; }
        stream = result;
        if (camera.current) { camera.current.srcObject = result; await camera.current.play(); }
      } catch (err) {
        if (cancelled) return;
        const name = err instanceof DOMException ? err.name : '';
        setError(name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access in your browser, or choose a photo from your device.' : name === 'NotFoundError' ? 'No camera found. Choose a photo from your device instead.' : err instanceof Error ? err.message : 'Camera unavailable. Try uploading a photo.');
        setCameraOpen(false);
      }
    }
    void startCamera();
    return () => { cancelled = true; stream?.getTracks().forEach(track => track.stop()); };
  }, [cameraOpen, target]);

  function selectFiles(files: File[]) {
    setError(''); setStatus('');
    if (!files.length) return;
    if (isPhoto && files.length + gallery.photo_count > maximum) {
      setError(`You can add ${maximum - gallery.photo_count} more photo${maximum - gallery.photo_count === 1 ? '' : 's'}. Each gallery holds up to ${maximum}.`); return;
    }
    const accepted = isPhoto ? ['image/jpeg', 'image/png', 'image/webp'] : ['video/mp4', 'video/webm'];
    const limit = (isPhoto ? 10 : 50) * 1024 * 1024;
    const invalid = files.find(file => !accepted.includes(file.type) || file.size === 0 || file.size > limit);
    if (invalid) {
      setError(`${invalid.name}: choose ${isPhoto ? 'a JPEG, PNG, or WebP photo up to 10 MB' : 'an MP4 or WebM video up to 50 MB'}.`); return;
    }
    setPending((isPhoto ? files : files.slice(0, 1)).map(file => ({ file, url: URL.createObjectURL(file) })));
  }

  function capturePhoto() {
    const video = camera.current;
    if (!video?.videoWidth || !video.videoHeight) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) { setError('Couldn’t capture that photo. Please try again.'); return; }
      selectFiles([new File([blob], `propvibe-${Date.now()}.jpg`, { type: 'image/jpeg' })]);
      setCameraOpen(false);
    }, 'image/jpeg', 0.92);
  }

  async function upload() {
    if (busy || !pending.length) return;
    setBusy(true); setError(''); setStatus('');
    try {
      onUpdate(await uploadMedia(target, kind, pending.map(item => item.file)));
      setPending([]);
      setStatus(isPhoto ? target === 'property' ? 'Property photos checked and saved to your listing.' : 'Profile photos uploaded and saved.' : 'Video uploaded and saved.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Upload failed. Your selection is still here; try again.'); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    setBusy(true); setError(''); setStatus('');
    try { onUpdate(await deleteMedia(id)); setStatus('Removed from your gallery.'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not remove this file. Try again.'); }
    finally { setBusy(false); }
  }

  return <div className="media-uploader">
    {isPhoto && <>
      <div className="photo-grid">{gallery.photos.map((photo, index) => <figure className="photo-tile" key={photo.id}>
        <img src={mediaUrl(photo.thumbnail_url)} alt={photo.caption || `Your photo ${index + 1}`} />
        {index === 0 && <figcaption>Cover</figcaption>}
        <button type="button" className="photo-remove" aria-label={`Remove photo ${index + 1}`} disabled={busy || pending.length > 0 || cameraOpen} onClick={() => remove(photo.id)}>×</button>
      </figure>)}
        {Array.from({ length: Math.max(0, gallery.minimum_photos - gallery.photo_count) }, (_, index) => <div className="photo-placeholder" key={`empty-${index}`}><span className="material-symbols-outlined" aria-hidden="true">add_photo_alternate</span><span>Photo {gallery.photo_count + index + 1}</span></div>)}
      </div>
      <p className="input-hint">{gallery.photo_count} of {maximum} photos · At least {gallery.minimum_photos} to continue. Your first photo is your cover.</p>
    </>}
    {!isPhoto && gallery.video && <div className="saved-video">
      <video controls playsInline preload="metadata" src={mediaUrl(gallery.video.url)} poster={mediaUrl(gallery.video.thumbnail_url)} aria-label={target === 'profile' ? 'Your introduction video' : 'Your home walkthrough'} />
      <button type="button" className="text-button" disabled={busy || pending.length > 0} onClick={() => remove(gallery.video!.id)}>Remove video</button>
    </div>}
    <input ref={picker} type="file" className="visually-hidden" tabIndex={-1} aria-label={isPhoto ? 'Choose photos' : 'Choose video'} accept={isPhoto ? 'image/jpeg,image/png,image/webp' : 'video/mp4,video/webm'} multiple={isPhoto} disabled={busy} onChange={e => { selectFiles(Array.from(e.target.files || [])); e.target.value = ''; }} />
    <input ref={deviceCamera} type="file" className="visually-hidden" tabIndex={-1} aria-label="Use device camera" accept="image/jpeg,image/png,image/webp" capture={target === 'profile' ? 'user' : 'environment'} disabled={busy} onChange={e => { selectFiles(Array.from(e.target.files || [])); e.target.value = ''; }} />

    {cameraOpen ? <div className="camera-panel">
      <video ref={camera} autoPlay playsInline muted onLoadedData={() => setCameraReady(true)} aria-label="Live camera preview" />
      <div className="flow-action-row"><button type="button" className="secondary-button" onClick={() => setCameraOpen(false)}>Cancel camera</button><button type="button" className="primary-button" disabled={!cameraReady} onClick={capturePhoto}>Capture photo</button></div>
    </div> : pending.length > 0 ? <div className="pending-media">
      <p className="eyebrow">Preview before uploading</p>
      <div className={isPhoto ? 'photo-grid' : 'video-preview'}>{pending.map(({ url }, index) => isPhoto
        ? <img className="pending-photo" key={url} src={url} alt={`Selected photo ${index + 1}`} />
        : <video key={url} src={url} controls playsInline preload="metadata" aria-label="Selected video preview" onLoadedMetadata={e => {
          if (!Number.isFinite(e.currentTarget.duration) || e.currentTarget.duration > 60) {
            setError('Choose a video up to 60 seconds long.'); setPending([]);
          }
        }} />)}</div>
      <div className="flow-action-row"><button type="button" className="secondary-button" disabled={busy} onClick={() => { setPending([]); setError(''); }}>Discard</button><button type="button" className="primary-button" disabled={busy} onClick={upload}>{busy ? 'Uploading…' : `Upload ${isPhoto ? `${pending.length} photo${pending.length > 1 ? 's' : ''}` : 'video'}`}</button></div>
    </div> : (!isPhoto || gallery.photo_count < maximum) && <div className="media-pick-actions">
      <button type="button" className="secondary-button" disabled={busy} onClick={() => picker.current?.click()}><span className="material-symbols-outlined" aria-hidden="true">{isPhoto ? 'add_photo_alternate' : 'video_library'}</span>{isPhoto ? 'Choose photos' : gallery.video ? 'Replace video' : 'Choose video'}</button>
      {isPhoto && <><button type="button" className="secondary-button" disabled={busy} onClick={() => { setError(''); setCameraReady(false); setCameraOpen(true); }}><span className="material-symbols-outlined" aria-hidden="true">photo_camera</span>Take a photo</button>
        <button type="button" className="text-button" disabled={busy} onClick={() => deviceCamera.current?.click()}>Use device camera instead</button></>}
    </div>}
    <p className="input-hint">{isPhoto ? 'JPEG, PNG or WebP · Up to 10 MB each · Choose distinct photos.' : 'MP4 (H.264) or WebM · Up to 60 seconds, 50 MB and 1080p.'}</p>
    {isPhoto && target === 'property' && <p className="input-hint">Show the rooms, kitchen, building and shared spaces without people. Local face detection checks property photos before saving. Portraits belong in your profile gallery.</p>}
    {error && <p className="flow-error" role="alert">{error}</p>}
    <p role="status" className="media-status">{busy ? isPhoto && target === 'property' ? 'Checking property photos and saving your listing…' : 'Saving your media. This may take a moment…' : status}</p>
  </div>;
}
