import type { LandmarkKind } from '../types/auth';
import type { QuestionOption } from '../types/onboarding';

const LANDMARK_KINDS: LandmarkKind[] = ['jain_derasar', 'mosque', 'temple', 'church', 'gurdwara',
  'public_transport', 'university', 'workplace', 'hospital', 'park', 'grocery', 'other'];
export const LANDMARK_OPTIONS: QuestionOption[] = LANDMARK_KINDS.map(value => ({
  value, label: value.replaceAll('_', ' ').replace(/^./, letter => letter.toUpperCase()),
}));
