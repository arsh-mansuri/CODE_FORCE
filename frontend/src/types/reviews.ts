import type { OfferingView } from './feed';

export type ReviewExperience = 'connected' | 'visited' | 'lived_here';
export type ReviewSort = 'recent' | 'helpful';

export interface ReviewPhoto {
  id: string;
  url: string;
  thumbnail_url: string;
  width: number;
  height: number;
}

export interface PropertyReview {
  id: string;
  listing_id: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  rating: number;
  experience: ReviewExperience;
  content: string;
  created_at: string;
  photos: ReviewPhoto[];
  helpful_count: number;
  helpful_by_me: boolean;
  is_mine: boolean;
}

export interface PropertyReviewFeed {
  items: PropertyReview[];
  highlights: PropertyReview[];
  total: number;
  average_rating: number | null;
  limit: number;
  offset: number;
  has_more: boolean;
  next_offset: number | null;
  can_review: boolean;
  own_review_id: string | null;
  eligibility_message: string;
}

export interface ReviewedProperty {
  listing: OfferingView;
  provider_name: string;
  provider_avatar: string | null;
  match_id: string | null;
  match_score: number | null;
  active_match: boolean;
  is_owner: boolean;
  review_count: number;
  average_rating: number | null;
}

export interface CreatePropertyReview {
  rating: number;
  experience: ReviewExperience;
  content: string;
  photos: File[];
}
