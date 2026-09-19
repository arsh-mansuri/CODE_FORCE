import type { DiscoveryCandidate, LifestyleChipData, PhotoCardData, PromptCardData, BentoInfoData, ApiCandidate as DiscoveryApiCandidate } from '../types/discovery';
import type { Candidate } from '../types/feed';
import type { Lifestyle } from '../types/auth';
import { mediaUrl } from './api';

type ApiCandidate = DiscoveryApiCandidate | Candidate;

const inr = (amount: number): string => `₹${amount.toLocaleString('en-IN')}`;

const badgeIcon = (badge: string): string => {
  const b = badge.toLowerCase();
  if (b.includes('early') || b.includes('bird')) return 'wb_sunny';
  if (b.includes('night') || b.includes('owl')) return 'bedtime';
  if (b.includes('hybrid')) return 'laptop_mac';
  if (b.includes('remote')) return 'wifi';
  if (b.includes('office')) return 'business_center';
  if (b.includes('vegetarian')) return 'restaurant';
  if (b.includes('vegan')) return 'eco';
  if (b.includes('smok')) return 'no_smoking';
  if (b.includes('pet')) return 'pets';
  if (b.includes('ac')) return 'ac_unit';
  if (b.includes('electric') || b.includes('power')) return 'bolt';
  if (b.includes('clean')) return 'cleaning_services';
  if (b.includes('quiet')) return 'volume_off';
  if (b.includes('wifi') || b.includes('internet')) return 'wifi';
  return 'tag';
};

const titleCase = (text: string): string =>
  text.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());

const sleepLabel = (schedule?: string): { icon: string; label: string } => {
  switch (schedule) {
    case 'early_bird': return { icon: 'wb_sunny', label: 'Early bird' };
    case 'night_owl': return { icon: 'bedtime', label: 'Night owl' };
    case 'flexible': return { icon: 'schedule', label: 'Flexible schedule' };
    default: return { icon: 'schedule', label: 'Schedule varies' };
  }
};

const workLabel = (style?: string): string => {
  switch (style) {
    case 'office': return 'In office';
    case 'hybrid': return 'Hybrid work';
    case 'remote': return 'Works remote';
    default: return 'Work varies';
  }
};

const dietIcon = (diet?: string): string => {
  switch (diet) {
    case 'vegetarian': return 'restaurant';
    case 'vegan': return 'eco';
    case 'jain': return 'spa';
    case 'omnivore': return 'restaurant';
    default: return 'restaurant';
  }
};

function lifestyleChips(lifestyle: Lifestyle | null): LifestyleChipData[] {
  if (!lifestyle) return [];
  const chips: LifestyleChipData[] = [];
  chips.push({ icon: 'cleaning_services', label: `Cleanliness: ${lifestyle.cleanliness}/5` });
  const sleep = sleepLabel(lifestyle.sleep_schedule ?? undefined);
  chips.push({ icon: sleep.icon, label: sleep.label });
  chips.push({ icon: bedIconForWork(lifestyle.work_style ?? undefined), label: workLabel(lifestyle.work_style ?? undefined) });
  if (lifestyle.diet) chips.push({ icon: dietIcon(lifestyle.diet), label: titleCase(lifestyle.diet) });
  if (lifestyle.smokes) chips.push({ icon: 'no_smoking', label: 'Smoker' });
  if (lifestyle.has_pets) chips.push({ icon: 'pets', label: 'Has pets' });
  return chips;
}

function bedIconForWork(style?: string): string {
  return style === 'office' ? 'business_center' : style === 'remote' ? 'wifi' : 'laptop_mac';
}

function budgetChip(candidate: ApiCandidate): LifestyleChipData | null {
  if (candidate.budget) {
    return {
      icon: 'payments',
      label: `Budget: ${inr(candidate.budget.minimum)}–${inr(candidate.budget.maximum)}/mo`,
      isBudget: true,
    };
  }
  if (candidate.card_type === 'property' && candidate.offering) {
    return { icon: 'payments', label: `Rent: ${inr(candidate.offering.monthly_rent)}/mo`, isBudget: true };
  }
  return null;
}

function buildChips(candidate: ApiCandidate): LifestyleChipData[] {
  const chips: LifestyleChipData[] = [];
  const budget = budgetChip(candidate);
  if (budget) chips.push(budget);
  chips.push(...lifestyleChips(candidate.lifestyle));
  candidate.badges?.forEach((badge) => chips.push({ icon: badgeIcon(badge), label: titleCase(badge) }));
  const seen = new Set<string>();
  const deduped: LifestyleChipData[] = [];
  for (const chip of chips) {
    const key = chip.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(chip);
  }
  return deduped;
}

function buildPhotos(candidate: ApiCandidate): PhotoCardData[] {
  const gallery = candidate.media.photos.length ? candidate.media : candidate.profile_media;
  return gallery.photos.map((photo, index) => ({
    id: photo.id || `${candidate.id}-photo-${index + 1}`,
    url: mediaUrl(photo.url),
    tag: photo.caption || candidate.location.label || candidate.location.city,
    aspectRatio: photo.height >= photo.width ? 'portrait' : 'landscape',
  }));
}

function buildPrompts(candidate: ApiCandidate): PromptCardData[] {
  const prompts: PromptCardData[] = [];
  const reasons = candidate.compatibility?.reasons ?? [];
  if (reasons[0]) prompts.push({ id: `${candidate.id}-reason-1`, label: 'WHY WE COULD CLICK...', text: reasons[0] });
  if (candidate.bio?.trim()) prompts.push({ id: `${candidate.id}-bio`, label: 'A LITTLE ABOUT ME...', text: candidate.bio.trim() });
  if (reasons[1]) prompts.push({ id: `${candidate.id}-reason-2`, label: 'WHAT I VALUE...', text: reasons[1] });
  if (candidate.card_type === 'property' && candidate.offering?.description?.trim()) {
    prompts.push({ id: `${candidate.id}-place`, label: 'THE PLACE...', text: candidate.offering.description.trim() });
  }
  return prompts.slice(0, 3);
}

const formatDate = (iso: string): string => {
  const date = new Date(`${iso}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' });
};

const LOCALITY_SUBTITLE = (candidate: ApiCandidate): string => {
  const parts = [...candidate.location.areas, ...candidate.location.pincodes].filter(Boolean);
  return parts.length ? parts.join(' · ') : `Open anywhere in ${candidate.location.city}`;
};

function buildBento(candidate: ApiCandidate): BentoInfoData {
  const moveIn = candidate.card_type === 'property' && candidate.offering
    ? {
        title: formatDate(candidate.offering.available_from),
        subtitle: `Available · min ${candidate.offering.minimum_stay_months} month stay`,
      }
    : { title: 'Flexible', subtitle: 'Negotiable move-in timing' };

  return {
    desiredArea: {
      title: candidate.location.label || candidate.location.city,
      subtitle: LOCALITY_SUBTITLE(candidate),
    },
    moveInDate: moveIn,
  };
}

function buildSubtitle(candidate: ApiCandidate): string {
  if (candidate.occupation) return candidate.occupation;
  if (candidate.card_type === 'property' && candidate.offering) return candidate.offering.title;
  return candidate.bio?.trim() || candidate.title;
}

export function toDiscoveryCandidate(candidate: ApiCandidate): DiscoveryCandidate {
  return {
    id: candidate.id,
    name: candidate.full_name,
    avatarUrl: mediaUrl(candidate.profile_media.cover_photo_url || candidate.profile_media.photos[0]?.url),
    age: candidate.age,
    verified: true,
    subtitle: buildSubtitle(candidate),
    locationCity: candidate.location.city,
    locationArea: candidate.location.areas[0] ?? candidate.location.city,
    matchScore: Math.round(candidate.match_score),
    chips: buildChips(candidate),
    photos: buildPhotos(candidate),
    prompts: buildPrompts(candidate),
    bento: buildBento(candidate),
  };
}
