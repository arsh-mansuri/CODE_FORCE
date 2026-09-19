export type Intent =
  | 'seek_roommate'
  | 'seek_room'
  | 'seek_entire_home'
  | 'offer_shared_home'
  | 'offer_entire_home';

export type Gender =
  | 'woman'
  | 'man'
  | 'non_binary'
  | 'self_described'
  | 'prefer_not_to_say';

export type PropertyType =
  | 'studio'
  | '1rk'
  | '1bhk'
  | '2bhk'
  | '3bhk'
  | '4bhk_plus'
  | 'other';

export type Diet =
  | 'vegetarian'
  | 'vegan'
  | 'jain'
  | 'omnivore'
  | 'other'
  | 'prefer_not_to_say';

export type LandmarkKind =
  | 'jain_derasar'
  | 'mosque'
  | 'temple'
  | 'church'
  | 'gurdwara'
  | 'public_transport'
  | 'university'
  | 'workplace'
  | 'hospital'
  | 'park'
  | 'grocery'
  | 'other';

export interface Budget {
  minimum: number;
  maximum: number;
}

export interface LandmarkPreference {
  kind: LandmarkKind;
  name?: string | null;
  max_distance_km: number;
  importance: 'preferred' | 'required';
}

export interface SearchLocation {
  city: string;
  areas: string[];
  pincodes: string[];
  nearby: LandmarkPreference[];
}

export interface HousingSearch {
  location: SearchLocation;
  budget: Budget;
  property_types: PropertyType[];
  move_in_from: string; // YYYY-MM-DD
  move_in_by: string;   // YYYY-MM-DD
  stay_months: number;
  ac_required?: boolean;
}

export interface Lifestyle {
  cleanliness?: number | null; // 1-5; unset means unanswered
  social_energy?: number | null;
  guests?: number | null;
  noise_tolerance?: number | null;
  sleep_schedule?: 'early_bird' | 'night_owl' | 'flexible' | null;
  work_style?: 'office' | 'hybrid' | 'remote' | 'varies' | null;
  diet?: Diet | null;
  smokes?: boolean | null;
  has_pets?: boolean | null;
}

export interface RoommatePreferences {
  genders: Gender[];
  smoking_ok: boolean | null;
  pets_ok: boolean | null;
  diets: Diet[];
}

export interface CompatibilityWeights {
  cleanliness: number;
  social_energy: number;
  guests: number;
  noise_tolerance: number;
  sleep_schedule: number;
  work_style: number;
  diet: number;
  smokes: number;
  has_pets: number;
}

export interface RoomPriorities {
  size: number;
  private_bathroom: number;
  balcony: number;
  natural_light: number;
  quiet: number;
}

export interface UserProfileInput {
  full_name: string;
  age: number;
  gender: Gender;
  gender_description?: string | null;
  occupation?: string | null;
  bio: string;
  intent: Intent;
  intents?: Intent[] | null;
  search?: HousingSearch | null;
  lifestyle?: Lifestyle | null;
  roommate_preferences: RoommatePreferences;
  compatibility_weights: CompatibilityWeights;
  room_priorities: RoomPriorities;
}

export interface ListingLocation {
  city: string;
  area: string;
  pincode: string;
}

export interface NearbyLandmark {
  kind: LandmarkKind;
  name: string;
  distance_km: number;
}

export interface ListingInput {
  title: string;
  description: string;
  kind: 'entire_home' | 'private_room' | 'shared_room';
  property_type: PropertyType;
  provider_relationship: 'owner' | 'tenant';
  location: ListingLocation;
  monthly_rent: number;
  deposit: number;
  electricity?: ElectricityBilling | null;
  air_conditioning?: AirConditioning | null;
  available_from: string;
  minimum_stay_months: number;
  available_spaces: number;
  furnishing: 'unfurnished' | 'semi_furnished' | 'furnished';
  amenities: string[];
  nearby_landmarks: NearbyLandmark[];
  is_active: boolean;
}

export interface BillSplit {
  method: 'equal' | 'metered_usage' | 'fixed_percentage' | 'tenant_pays_full' | 'custom';
  split_between?: number;
  tenant_share_percentage?: number;
  custom_details?: string;
}

export interface ElectricityBilling {
  billing_method: 'included_in_rent' | 'fixed_monthly' | 'per_kwh' | 'actual_bill';
  rate_per_kwh?: number;
  fixed_monthly_amount?: number;
  split?: BillSplit;
  notes?: string;
}

export interface AirConditioning {
  available: boolean;
  locations?: string[];
  billing_method?: 'included_in_rent' | 'included_in_electricity' | 'separate_per_kwh' | 'separate_per_hour' | 'separate_fixed_monthly';
  rate_per_kwh?: number;
  rate_per_hour?: number;
  fixed_monthly_amount?: number;
  split?: BillSplit;
  notes?: string;
}

export interface MediaView {
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
  caption: string;
  created_at: string;
}

export interface MediaGallery {
  photos: MediaView[];
  video: MediaView | null;
  cover_photo_url: string | null;
  photo_count: number;
  minimum_photos: number;
  maximum_photos: number;
  ready: boolean;
}

export interface OnboardingStatus {
  complete: boolean;
  profile_photos_needed: number;
  property_photos_needed: number;
  next_steps: string[];
}

export interface MediaResponse {
  target: 'profile' | 'property';
  gallery: MediaGallery;
  onboarding: OnboardingStatus;
}

export interface ListingView extends ListingInput {
  id: string;
  owner_id: string;
  created_at: string;
  media: MediaGallery;
}

export interface AccountDeletionStatus {
  requested_at: string;
  scheduled_for: string;
}

export interface UserProfile {
  id: string;
  email: string;
  profile: UserProfileInput;
  offering: ListingView | null;
  created_at: string;
  media: MediaGallery;
  onboarding: OnboardingStatus;
  deletion_request?: AccountDeletionStatus | null;
}

export interface AuthResponse {
  access_token: string;
  token_type: 'bearer';
  expires_at: string;
  user: UserProfile;
}

export interface SignupRequest {
  email: string;
  password: string;
  profile: UserProfileInput;
  offering?: ListingInput | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}
