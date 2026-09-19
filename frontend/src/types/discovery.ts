export interface LifestyleChipData {
  icon: string;
  label: string;
  isBudget?: boolean;
}

export interface PromptCardData {
  id: string;
  label: string;
  text: string;
}

export interface PhotoCardData {
  id: string;
  url: string;
  tag: string;
  aspectRatio?: 'portrait' | 'landscape';
}

export interface BentoInfoData {
  desiredArea: {
    title: string;
    subtitle: string;
  };
  moveInDate: {
    title: string;
    subtitle: string;
  };
}

export interface DiscoveryCandidate {
  id: string;
  name: string;
  avatarUrl?: string;
  age: number;
  verified: boolean;
  subtitle: string;
  locationCity: string;
  locationArea: string;
  matchScore: number;
  chips: LifestyleChipData[];
  photos: PhotoCardData[];
  prompts: PromptCardData[];
  bento: BentoInfoData;
}

export type SwipeDirection = 'like' | 'pass' | 'superlike';

export interface ApiCompatibility {
  score: number;
  cosine_similarity: number | null;
  method: 'weighted_cosine' | 'housing_fit';
  reasons: string[];
}

export interface ApiCardLocation {
  city: string;
  areas: string[];
  pincodes: string[];
  label: string;
  kind: 'property' | 'search_preference';
}

export interface ApiCandidate {
  id: string;
  full_name: string;
  age: number;
  gender: string;
  occupation: string | null;
  bio: string;
  intent: string;
  intents?: string[];
  lifestyle: import('./auth').Lifestyle | null;
  offering: import('./auth').ListingView | null;
  compatibility: ApiCompatibility;
  match_score: number;
  card_type: 'person' | 'property';
  title: string;
  location: ApiCardLocation;
  media: import('./auth').MediaGallery;
  profile_media: import('./auth').MediaGallery;
  budget: import('./auth').Budget | null;
  badges: string[];
}

export interface DiscoveryFeedResponse {
  items: ApiCandidate[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
  next_offset: number | null;
}

export interface SwipeResponse {
  matched: boolean;
  match_id: string | null;
  message: string;
}
