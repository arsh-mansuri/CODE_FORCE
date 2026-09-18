import type {
  Intent,
  PropertyType,
  SignupRequest,
} from '../types/auth';
import { localDate } from './dates';
import { selectedIntents } from './intents';

/**
 * Get initial default answers for dynamic questions
 */
export function getDefaultAnswers(): Record<string, any> {
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextMonth = new Date();
  nextMonth.setDate(nextMonth.getDate() + 37);

  return {
    email: '',
    password: '',
    'profile.full_name': '',
    'profile.age': undefined,
    'profile.gender': 'prefer_not_to_say',
    'profile.gender_description': '',
    'profile.occupation': '',
    'profile.bio': '',
    'profile.intent': 'seek_roommate' as Intent,
    'profile.intents': ['seek_roommate'] as Intent[],

    // Search fields
    'profile.search.location.city': '',
    'profile.search.location.areas': [],
    'profile.search.location.pincodes': [],
    'profile.search.budget': { minimum: 6000, maximum: 16000 },
    'profile.search.property_types': ['1bhk', '2bhk'] as PropertyType[],
    'profile.search.move_in_from': localDate(nextWeek),
    'profile.search.move_in_by': localDate(nextMonth),
    'profile.search.stay_months': 12,

    // Lifestyle fields
    'profile.lifestyle.cleanliness': 4,
    'profile.lifestyle.social_energy': 3,
    'profile.lifestyle.guests': 2,
    'profile.lifestyle.noise_tolerance': 2,
    'profile.lifestyle.sleep_schedule': 'early_bird',
    'profile.lifestyle.work_style': 'hybrid',
    'profile.lifestyle.diet': 'vegetarian',
    'profile.lifestyle.smokes': false,
    'profile.lifestyle.has_pets': false,

    // Roommate preferences
    'profile.roommate_preferences.genders': [],
    'profile.roommate_preferences.smoking_ok': null,
    'profile.roommate_preferences.pets_ok': null,
    'profile.roommate_preferences.diets': [],

    // Room Priorities (Rent Harmony)
    'profile.room_priorities': {
      size: 3,
      private_bathroom: 4,
      balcony: 2,
      natural_light: 3,
      quiet: 4,
    },

    // Compatibility weights
    'profile.compatibility_weights': {
      cleanliness: 3,
      social_energy: 3,
      guests: 3,
      noise_tolerance: 3,
      sleep_schedule: 3,
      work_style: 2,
      diet: 2,
      smokes: 3,
      has_pets: 2,
    },

    // Offering fields
    'offering.title': '',
    'offering.description': '',
    'offering.kind': 'private_room',
    'offering.property_type': '2bhk',
    'offering.provider_relationship': 'tenant',
    'offering.location': {
      city: '',
      area: '',
      pincode: '',
    },
    'offering.monthly_rent': 12000,
    'offering.deposit': 12000,
    'offering.available_from': localDate(nextWeek),
    'offering.minimum_stay_months': 6,
    'offering.available_spaces': 1,
    'offering.furnishing': 'semi_furnished',
    'offering.amenities': [],
    'offering.nearby_landmarks': [],
    'offering.is_active': true,

  };
}

/**
 * Builds the strict SignupRequest payload expected by FastAPI backend
 */
export function buildSignupPayload(answers: Record<string, any>): SignupRequest {
  const intents = selectedIntents(answers);
  const intent: Intent = intents[0]?.startsWith('offer_')
    ? answers['offering.kind'] === 'entire_home' ? 'offer_entire_home' : 'offer_shared_home'
    : intents[0] || 'seek_roommate';
  const isSeeking = ['seek_entire_home', 'seek_room', 'seek_roommate'].includes(intent);
  const isSharing = intents.some(value => ['seek_room', 'seek_roommate', 'offer_shared_home'].includes(value));
  const isOffering = ['offer_entire_home', 'offer_shared_home'].includes(intent);

  // Search construction
  let searchPayload = null;
  if (isSeeking) {
    const rawAreas = answers['profile.search.location.areas'];
    const areasList = Array.isArray(rawAreas)
      ? rawAreas
      : typeof rawAreas === 'string'
      ? rawAreas.split(',').map((s) => s.trim()).filter(Boolean)
      : ['Navrangpura'];

    const rawPincodes = answers['profile.search.location.pincodes'];
    const pincodesList = Array.isArray(rawPincodes)
      ? rawPincodes
      : typeof rawPincodes === 'string'
      ? rawPincodes.split(',').map((s) => s.trim()).filter(Boolean)
      : ['380009'];

    const budget = answers['profile.search.budget'] || { minimum: 6000, maximum: 16000 };
    const propertyTypes = answers['profile.search.property_types'] || ['1bhk', '2bhk'];

    searchPayload = {
      location: {
        city: answers['profile.search.location.city'] || 'Ahmedabad',
        areas: areasList.filter(Boolean),
        pincodes: pincodesList.filter(Boolean),
        nearby: answers['profile.search.location.nearby'] || [],
      },
      budget: {
        minimum: Number(budget.minimum ?? 0),
        maximum: Number(budget.maximum),
      },
      property_types: Array.isArray(propertyTypes) && propertyTypes.length > 0 ? propertyTypes : ['1bhk'],
      move_in_from: answers['profile.search.move_in_from'],
      move_in_by: answers['profile.search.move_in_by'],
      stay_months: Number(answers['profile.search.stay_months'] || 12),
      ac_required: Boolean(answers['profile.search.ac_required']),
    };
  }

  // Lifestyle construction
  let lifestylePayload = null;
  if (isSharing) {
    lifestylePayload = {
      cleanliness: Number(answers['profile.lifestyle.cleanliness'] || 4),
      social_energy: Number(answers['profile.lifestyle.social_energy'] || 3),
      guests: Number(answers['profile.lifestyle.guests'] || 2),
      noise_tolerance: Number(answers['profile.lifestyle.noise_tolerance'] || 2),
      sleep_schedule: answers['profile.lifestyle.sleep_schedule'] || 'early_bird',
      work_style: answers['profile.lifestyle.work_style'] || 'hybrid',
      diet: answers['profile.lifestyle.diet'] || 'vegetarian',
      smokes: Boolean(answers['profile.lifestyle.smokes']),
      has_pets: Boolean(answers['profile.lifestyle.has_pets']),
    };
  }

  // Roommate preferences
  const roommatePreferences = isSharing
    ? {
        genders: answers['profile.roommate_preferences.genders'] || [],
        smoking_ok:
          answers['profile.roommate_preferences.smoking_ok'] === undefined
            ? null
            : answers['profile.roommate_preferences.smoking_ok'],
        pets_ok:
          answers['profile.roommate_preferences.pets_ok'] === undefined
            ? null
            : answers['profile.roommate_preferences.pets_ok'],
        diets: answers['profile.roommate_preferences.diets'] || [],
      }
    : { genders: [], smoking_ok: null, pets_ok: null, diets: [] };

  // Offering construction
  let offeringPayload = null;
  if (isOffering) {
    const loc = answers['offering.location'] || {
      city: 'Ahmedabad',
      area: 'Navrangpura',
      pincode: '380009',
    };
    const kind = intent === 'offer_entire_home' ? 'entire_home' : (answers['offering.kind'] || 'private_room');

    offeringPayload = {
      title: answers['offering.title'] || 'Bright Flat in Navrangpura',
      description: answers['offering.description'] || '',
      kind,
      property_type: answers['offering.property_type'] || '2bhk',
      provider_relationship: answers['offering.provider_relationship'] || 'tenant',
      location: {
        city: loc.city || 'Ahmedabad',
        area: loc.area || 'Navrangpura',
        pincode: loc.pincode || '380009',
      },
      monthly_rent: Number(answers['offering.monthly_rent'] || 12000),
      deposit: Number(answers['offering.deposit'] || 0),
      electricity: buildElectricity(answers),
      air_conditioning: buildAirConditioning(answers),
      available_from: answers['offering.available_from'],
      minimum_stay_months: Number(answers['offering.minimum_stay_months'] || 1),
      available_spaces: kind === 'entire_home' ? 1 : Number(answers['offering.available_spaces'] || 1),
      furnishing: answers['offering.furnishing'] || 'unfurnished',
      amenities: answers['offering.amenities'] || [],
      nearby_landmarks: answers['offering.nearby_landmarks'] || [],
      is_active: answers['offering.is_active'] !== false,
    };
  }

  const gender = answers['profile.gender'] || 'prefer_not_to_say';
  const genderDesc =
    gender === 'self_described' ? answers['profile.gender_description']?.trim() || null : null;

  return {
    email: answers.email.trim().toLowerCase(),
    password: answers.password,
    profile: {
      full_name: answers['profile.full_name'].trim(),
      age: Number(answers['profile.age']),
      gender,
      gender_description: genderDesc,
      occupation: answers['profile.occupation']?.trim() || null,
      bio: answers['profile.bio'] ? answers['profile.bio'].trim() : '',
      intent,
      intents,
      search: searchPayload,
      lifestyle: lifestylePayload,
      roommate_preferences: roommatePreferences,
      compatibility_weights: answers['profile.compatibility_weights'] || {
        cleanliness: 3,
        social_energy: 3,
        guests: 3,
        noise_tolerance: 3,
        sleep_schedule: 3,
        work_style: 2,
        diet: 2,
        smokes: 3,
        has_pets: 2,
      },
      room_priorities: answers['profile.room_priorities'] || {
        size: 3,
        private_bathroom: 4,
        balcony: 2,
        natural_light: 3,
        quiet: 4,
      },
    },
    offering: offeringPayload,
  };
}

function buildSplit(answers: Record<string, any>, path: string) {
  const method = answers[`${path}.method`];
  return {
    method,
    ...(method === 'equal' ? { split_between: Number(answers[`${path}.split_between`]) } : {}),
    ...(method === 'fixed_percentage' ? { tenant_share_percentage: Number(answers[`${path}.tenant_share_percentage`]) } : {}),
    ...(method === 'custom' ? { custom_details: answers[`${path}.custom_details`] } : {}),
  };
}

function buildElectricity(answers: Record<string, any>) {
  const path = 'offering.electricity';
  const method = answers[`${path}.billing_method`];
  if (!method) return null;
  return {
    billing_method: method,
    ...(method === 'per_kwh' ? { rate_per_kwh: Number(answers[`${path}.rate_per_kwh`]) } : {}),
    ...(method === 'fixed_monthly' ? { fixed_monthly_amount: Number(answers[`${path}.fixed_monthly_amount`]) } : {}),
    ...(method !== 'included_in_rent' ? { split: buildSplit(answers, `${path}.split`) } : {}),
    ...(answers[`${path}.notes`] ? { notes: answers[`${path}.notes`] } : {}),
  };
}

function buildAirConditioning(answers: Record<string, any>) {
  const path = 'offering.air_conditioning';
  const available = answers[`${path}.available`];
  if (available == null) return null;
  if (!available) return { available: false };
  const method = answers[`${path}.billing_method`];
  const rate = ({ separate_per_kwh: 'rate_per_kwh', separate_per_hour: 'rate_per_hour', separate_fixed_monthly: 'fixed_monthly_amount' } as Record<string, string>)[method];
  return {
    available: true, locations: answers[`${path}.locations`] || [], billing_method: method,
    ...(rate ? { [rate]: Number(answers[`${path}.${rate}`]), split: buildSplit(answers, `${path}.split`) } : {}),
    ...(answers[`${path}.notes`] ? { notes: answers[`${path}.notes`] } : {}),
  };
}
