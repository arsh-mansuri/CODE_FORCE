import type { Compatibility } from '../types/feed';
import './MatchFitSummary.css';

export function MatchFitSummary({ compatibility, compact = false }: {
  compatibility: Compatibility;
  compact?: boolean;
}) {
  const compromises = compatibility.compromises ?? [];
  const positives = compatibility.matched_preferences ?? [];
  if (!compatibility.match_type && !compromises.length && !positives.length) return null;

  const alternative = compatibility.match_type === 'alternative' || compromises.length > 0;
  return <section className={`match-fit-summary${alternative ? ' match-fit-summary--alternative' : ''}`} aria-label="Preference match details">
    <h4 className="match-fit-summary__heading">
      <span className="material-symbols-outlined" aria-hidden="true">{alternative ? 'tune' : 'check_circle'}</span>
      {alternative ? 'Alternative · a few things to consider' : 'Matches your evaluated preferences'}
    </h4>
    {!compact && positives.length > 0 && <>
      <p className="match-fit-summary__label">What fits</p>
      <ul>{positives.map(reason => <li key={reason}>{reason}</li>)}</ul>
    </>}
    {compromises.length > 0 && <>
      <p className="match-fit-summary__label">Trade-offs to consider</p>
      <ul>{compromises.map(reason => <li key={reason}>{reason}</li>)}</ul>
    </>}
    {!compact && <p className="match-fit-summary__note">The match percentage reflects your saved housing preferences{compatibility.method === 'weighted_cosine' ? ' and shared-living compatibility' : ''}. It is a ranking score, not a guarantee.</p>}
  </section>;
}
