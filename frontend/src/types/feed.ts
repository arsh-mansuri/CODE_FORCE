import type { Gender, Intent, Lifestyle, PropertyType, Budget } from './auth';

export interface CardLocation {
  city: string;
  areas: string[];
  pincodes: string[];
  label: string;
  kind: 'property' | 'search_preference';
}

export interface Compatibility {
  score: number;
  cosine_similarity: number | null;
  method: 'weighted_cosine' | 'housing_fit';
  reasons: string[];
}

export interface MediaAsset {
  id: string;
  kind: 'photo' | 'video';
  url: string;
  thumbnail_url: string;
  content_type: string;
  byte_size: number;
  width: number;
  height: number;
  duration_seconds: number | null;
  position: number;
  caption: string | null;
  created_at: string;
}

export interface MediaGallery {
  photos: MediaAsset[];
  video: MediaAsset | null;
  cover_photo_url: string | null;
  photo_count: number;
  minimum_photos: number;
  maximum_photos: number;
  ready: boolean;
}

export interface BillSplit {
  method: 'equal' | 'metered_usage' | 'fixed_percentage' | 'tenant_pays_full' | 'custom';
  split_between?: number;
  tenant_share_percentage?: number;
  custom_details?: string;
}

export interface ElectricityPolicy {
  billing_method: 'included_in_rent' | 'fixed_monthly' | 'per_kwh' | 'actual_bill';
  rate_per_kwh?: number;
  fixed_monthly_amount?: number;
  split?: BillSplit;
  notes?: string;
}

export interface AirConditioningPolicy {
  available: boolean;
  locations?: string[];
  billing_method?: 'included_in_rent' | 'included_in_electricity' | 'separate_per_kwh' | 'separate_per_hour' | 'separate_fixed_monthly';
  rate_per_kwh?: number;
  rate_per_hour?: number;
  fixed_monthly_amount?: number;
  split?: BillSplit;
  notes?: string;
}

export interface NearbyLandmark {
  kind: string;
  name: string;
  distance_km: number;
}

export interface OfferingView {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  kind: 'entire_home' | 'private_room' | 'shared_room';
  property_type: PropertyType;
  provider_relationship: string;
  location: {
    city: string;
    area: string;
    pincode: string;
  };
  monthly_rent: number;
  deposit: number;
  electricity: ElectricityPolicy | null;
  air_conditioning: AirConditioningPolicy | null;
  available_from: string;
  minimum_stay_months: number;
  available_spaces: number;
  furnishing: 'unfurnished' | 'semi_furnished' | 'furnished';
  amenities: string[];
  nearby_landmarks: NearbyLandmark[];
  is_active: boolean;
  created_at: string;
  media: MediaGallery;
}

export interface Candidate {
  id: string;
  full_name: string;
  age: number;
  gender: Gender;
  occupation: string | null;
  bio: string;
  intent: Intent;
  lifestyle: Lifestyle | null;
  offering: OfferingView | null;
  compatibility: Compatibility;
  match_score: number;
  card_type: 'person' | 'property';
  title: string;
  location: CardLocation;
  media: MediaGallery;
  profile_media: MediaGallery;
  budget: Budget | null;
  badges: string[];
}

export interface FeedResponse {
  passed_count: number;
  items: Candidate[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
  next_offset: number | null;
}

export interface SwipeRequest {
  target_id: string;
  direction: 'like' | 'pass' | 'superlike';
}

export interface SwipeResponse {
  matched: boolean;
  match_id: string | null;
  message?: string;
}

export interface FeedQueryParams {
  limit?: number;
  offset?: number;
  include_seen?: boolean;
  min_match_score?: number;
}

export interface ListingFeedItem {
  listing: OfferingView;
  compatibility: Compatibility;
  match_score: number;
  provider_name: string;
}

export interface ListingFeed {
  items: ListingFeedItem[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
  next_offset: number | null;
}
