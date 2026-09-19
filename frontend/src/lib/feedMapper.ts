import type { Candidate } from '../types/feed';
import type { DiscoveryCandidate } from '../types/discovery';
import { mediaUrl } from './api';

export function discoveryCandidate(item: Candidate): DiscoveryCandidate {
  const rent = item.offering ? `₹${item.offering.monthly_rent.toLocaleString('en-IN')}/mo`
    : item.budget ? `₹${item.budget.minimum.toLocaleString('en-IN')}–${item.budget.maximum.toLocaleString('en-IN')}/mo` : '';
  return {
    id: item.id, name: item.full_name, age: item.age, verified: false,
    subtitle: [item.occupation, item.location.label].filter(Boolean).join(' · '),
    locationCity: item.location.city, locationArea: item.location.areas.join(', '), matchScore: item.match_score,
    matchDetails: item.compatibility,
    chips: [...(rent ? [{ icon: 'payments', label: rent, isBudget: true }] : []),
      ...item.badges.map(label => ({ icon: 'home', label }))],
    photos: item.media.photos.map(photo => ({ id: photo.id, url: mediaUrl(photo.url), tag: photo.caption || item.title })),
    prompts: [
      ...(item.bio ? [{ id: 'bio', label: 'A little about me', text: item.bio }] : []),
      { id: 'fit', label: 'Why this suggestion', text: item.compatibility.reasons.join(' ') },
      ...(item.offering?.description ? [{ id: 'home', label: 'About this home', text: item.offering.description }] : []),
    ],
    bento: {
      desiredArea: { title: item.location.label, subtitle: item.location.kind === 'property' ? 'Home location' : 'Preferred search area' },
      moveInDate: { title: item.offering?.available_from || 'Let’s discuss', subtitle: item.offering ? 'Available from' : 'Compare your move-in plans' },
    },
  };
}
