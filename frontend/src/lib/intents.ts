import type { Intent } from '../types/auth';

export const INTENT_GROUPS: { label: string; description: string; values: Intent[] }[] = [
  { label: 'Looking for a place', description: 'Select all the ways you’re open to finding home.', values: ['seek_entire_home', 'seek_room', 'seek_roommate'] },
  { label: 'Offering a place', description: 'Select the ways you’d like to share your space.', values: ['offer_entire_home', 'offer_shared_home'] },
];

export const INTENT_LABELS: Record<Intent, string> = {
  seek_entire_home: 'Find a whole home', seek_room: 'Find a room', seek_roommate: 'Find my people',
  offer_entire_home: 'List my property', offer_shared_home: 'Share my home',
};

export function selectedIntents(answers: Record<string, any>): Intent[] {
  return answers['profile.intents'] ?? (answers['profile.intent'] ? [answers['profile.intent']] : []);
}

export function toggleIntent(selected: Intent[], value: Intent): Intent[] {
  if (selected.includes(value)) return selected.filter(intent => intent !== value);
  const sameGroup = selected.filter(intent => intent.startsWith('seek_') === value.startsWith('seek_'));
  return [...sameGroup, value];
}
