import type { Intent } from '../types/auth';
import type { InputType, Question, Questionnaire } from '../types/onboarding';
import { LANDMARK_OPTIONS } from './questionOptions';

// Mirrors the API fields/options, including conditional utility billing. The live
// questionnaire remains authoritative; this is used only when it cannot be fetched.
const SEEK: Intent[] = ['seek_entire_home', 'seek_room', 'seek_roommate'];
const OFFER: Intent[] = ['offer_entire_home', 'offer_shared_home'];
const SHARE: Intent[] = ['seek_room', 'seek_roommate', 'offer_shared_home'];
const ALL = [...SEEK, ...OFFER];
const GENDERS = ['woman', 'man', 'non_binary', 'self_described', 'prefer_not_to_say'];
const DIETS = ['vegetarian', 'vegan', 'jain', 'omnivore', 'other', 'prefer_not_to_say'];
const LAYOUTS = ['studio', '1rk', '1bhk', '2bhk', '3bhk', '4bhk_plus', 'other'];
const q = (field: string, prompt: string, input_type: InputType, applies_to = ALL,
  required = false, choices: string[] = [], help_text = '', show_when: Question['show_when'] = {}): Question => ({
  field, prompt, input_type, applies_to, required, help_text, show_when,
  options: choices.map(value => ({ value, label: value.replaceAll('_', ' ').replace(/^./, c => c.toUpperCase()) })), used_for: [],
});
const priorityHelp = 'Optional. Prioritize what matters to you; differences do not exclude suggestions.';
const electric = 'offering.electricity';
const ac = 'offering.air_conditioning';
const electricCharged = { [`${electric}.billing_method`]: ['per_kwh', 'fixed_monthly', 'actual_bill'] };
const acCharged = { [`${ac}.available`]: [true], [`${ac}.billing_method`]: ['separate_per_kwh', 'separate_per_hour', 'separate_fixed_monthly'] };
function splits(path: string, when: Question['show_when']): Question[] {
  return [
    q(`${path}.method`, 'How will this charge be shared?', 'single_choice', OFFER, true,
      ['equal', 'metered_usage', 'fixed_percentage', 'tenant_pays_full', 'custom'], '', when),
    q(`${path}.split_between`, 'How many people or households share this bill equally?', 'number', OFFER, true, [], 'Count all payers, including the incoming tenant.', { ...when, [`${path}.method`]: ['equal'] }),
    q(`${path}.tenant_share_percentage`, 'What percentage does the incoming tenant pay?', 'number', OFFER, true, [], 'Above 0 and up to 100.', { ...when, [`${path}.method`]: ['fixed_percentage'] }),
    q(`${path}.custom_details`, 'How does your agreed split work?', 'text', OFFER, true, [], '', { ...when, [`${path}.method`]: ['custom'] }),
  ];
}

export const FALLBACK_QUESTIONNAIRE: Questionnaire = {
  version: '1.2', introduction: 'Start with the essentials. Add your preferences later, at your own pace.',
  sections: [
    { id: 'account', title: "Let's get to know you", questions: [
      q('email', 'Which email would you like to sign in with?', 'email', ALL, true, [], 'Private; never shown on discovery cards.'),
      q('password', 'Choose a password', 'password', ALL, true, [], 'Use 10–128 characters.'),
      q('profile.full_name', 'What name would you like people to see?', 'text', ALL, true),
      q('profile.age', 'How old are you?', 'number', ALL, true, [], 'PropVibe is for adults aged 18 and above.'),
      q('profile.gender', 'How would you like to describe your gender?', 'single_choice', ALL, false, GENDERS),
      q('profile.gender_description', 'Would you like to describe that in your own words?', 'text'),
      q('profile.occupation', 'What keeps you busy most days?', 'text'),
      q('profile.bio', 'What would you like a future housemate or provider to know?', 'text'),
      q('profile.intents', 'What would help you right now?', 'multi_choice', ALL, true, ALL, 'Choose one or more goals within a category.'),
    ] },
    { id: 'search', title: 'Your next home', questions: [
      q('profile.search.location.city', 'Which city would work for you?', 'text', SEEK, true),
      q('profile.search.location.areas', 'Any neighbourhoods you would like to be in?', 'list', SEEK, false, [], priorityHelp),
      q('profile.search.location.pincodes', 'Do you have preferred PIN codes?', 'list', SEEK, false, [], 'Six-digit Indian PIN codes.'),
      q('profile.search.location.nearby', 'Is there a place you would like to live near?', 'list', SEEK, false, LANDMARK_OPTIONS.map(o => o.value), priorityHelp),
      q('profile.search.budget', 'What monthly rent range feels comfortable?', 'object', SEEK, true, [], 'Monthly INR, excluding utilities and deposit. Whole-home rent or your individual share for rooms.'),
      q('profile.search.property_types', 'Which home layouts would work?', 'multi_choice', SEEK, true, LAYOUTS),
      q('profile.search.move_in_from', "What's your earliest move-in date?", 'date', SEEK, true),
      q('profile.search.move_in_by', "What's your latest comfortable move-in date?", 'date', SEEK, true),
      q('profile.search.stay_months', 'How many months do you expect to stay?', 'number', SEEK, true),
      q('profile.search.ac_required', 'Do you need access to an installed air conditioner?', 'boolean', SEEK, false, [], priorityHelp),
    ] },
    { id: 'lifestyle', title: 'How home feels for you', questions: [
      q('profile.lifestyle.cleanliness', 'How do you like shared spaces to be kept?', 'scale', SHARE, false, [], '1: relaxed about clutter; 5: frequent tidying.'),
      q('profile.lifestyle.social_energy', 'How much together-time feels good at home?', 'scale', SHARE),
      q('profile.lifestyle.guests', 'How often do you tend to host visitors?', 'scale', SHARE),
      q('profile.lifestyle.noise_tolerance', 'What sound level feels comfortable at home?', 'scale', SHARE),
      q('profile.lifestyle.sleep_schedule', 'Which sleep routine is closest to yours?', 'single_choice', SHARE, false, ['early_bird', 'night_owl', 'flexible']),
      q('profile.lifestyle.work_style', 'Where do you usually work or study?', 'single_choice', SHARE, false, ['office', 'hybrid', 'remote', 'varies']),
      q('profile.lifestyle.diet', 'Which food routine best describes yours?', 'single_choice', SHARE, false, DIETS),
      q('profile.lifestyle.smokes', 'Do you currently smoke?', 'boolean', SHARE),
      q('profile.lifestyle.has_pets', 'Will any pets move in with you?', 'boolean', SHARE),
    ] },
    { id: 'preferences', title: 'What makes sharing comfortable?', questions: [
      q('profile.roommate_preferences.genders', 'Who would you feel comfortable sharing a home with?', 'multi_choice', SHARE, false, GENDERS, priorityHelp),
      q('profile.roommate_preferences.smoking_ok', 'Would sharing with someone who smokes work for you?', 'boolean', SHARE, false, [], priorityHelp),
      q('profile.roommate_preferences.pets_ok', 'Would living with pets work for you?', 'boolean', SHARE, false, [], priorityHelp),
      q('profile.roommate_preferences.diets', 'Do you need a particular shared-kitchen food routine?', 'multi_choice', SHARE, false, DIETS, priorityHelp),
      q('profile.compatibility_weights', 'Which parts of home life matter most to you?', 'object', SHARE, false, [], '0–5 for each priority. At least one must be above zero.'),
      q('profile.room_priorities', 'What would you value most in your own room?', 'object', SHARE),
    ] },
    { id: 'offering', title: "The home or space you're offering", questions: [
      q('offering.title', 'How would you describe the space in one line?', 'text', OFFER, true),
      q('offering.description', 'What else should someone know about the home?', 'text', OFFER),
      q('offering.kind', 'Which space would you like to list first?', 'single_choice', OFFER, true, ['entire_home', 'private_room', 'shared_room']),
      q('offering.property_type', "What's the layout of the whole home?", 'single_choice', OFFER, true, LAYOUTS),
      q('offering.provider_relationship', 'Do you own this home or currently rent it?', 'single_choice', OFFER, true, ['owner', 'tenant']),
      q('offering.location', 'Where is the home?', 'object', OFFER, true, [], 'City, neighbourhood and six-digit PIN code.'),
      q('offering.monthly_rent', 'What monthly rent are you asking?', 'number', OFFER, true),
      q('offering.deposit', 'Is a refundable deposit requested?', 'number', OFFER),
      q('offering.available_from', 'When can someone move in?', 'date', OFFER, true),
      q('offering.minimum_stay_months', "What's the minimum stay?", 'number', OFFER),
      q('offering.available_spaces', 'How many people can move into the shared home?', 'number', OFFER),
      q('offering.furnishing', 'How furnished is the space?', 'single_choice', OFFER, false, ['unfurnished', 'semi_furnished', 'furnished']),
      q('offering.amenities', 'What does the home offer?', 'list', OFFER),
      q('offering.nearby_landmarks', 'Which useful places are nearby?', 'list', OFFER, false, LANDMARK_OPTIONS.map(o => o.value), 'Provider-declared distances.'),
      q('offering.is_active', 'Is the space currently available for discovery?', 'boolean', OFFER),
    ] },
    { id: 'electricity_and_ac', title: 'Electricity and cooling costs', questions: [
      q(`${electric}.billing_method`, 'How is electricity charged?', 'single_choice', OFFER, false, ['included_in_rent', 'fixed_monthly', 'per_kwh', 'actual_bill'], 'Leave unset if unknown; unknown does not mean free.'),
      q(`${electric}.rate_per_kwh`, 'What electricity rate applies per unit?', 'number', OFFER, true, [], 'INR per kWh before splitting.', { [`${electric}.billing_method`]: ['per_kwh'] }),
      q(`${electric}.fixed_monthly_amount`, 'What is the fixed monthly electricity charge?', 'number', OFFER, true, [], 'Total INR before splitting.', { [`${electric}.billing_method`]: ['fixed_monthly'] }),
      ...splits(`${electric}.split`, electricCharged),
      q(`${electric}.notes`, 'Is there anything else to explain about the electricity bill?', 'text', OFFER, false, [], '', { [`${electric}.billing_method`]: ['included_in_rent', 'fixed_monthly', 'per_kwh', 'actual_bill'] }),
      q(`${ac}.available`, 'Is an air conditioner installed and available to the incoming tenant?', 'boolean', OFFER),
      q(`${ac}.locations`, 'Where can the incoming tenant use the AC?', 'list', OFFER, false, [], '', { [`${ac}.available`]: [true] }),
      q(`${ac}.billing_method`, 'Is AC use included, or charged separately?', 'single_choice', OFFER, true, ['included_in_rent', 'included_in_electricity', 'separate_per_kwh', 'separate_per_hour', 'separate_fixed_monthly'], '', { [`${ac}.available`]: [true] }),
      ...(['rate_per_kwh', 'rate_per_hour', 'fixed_monthly_amount'] as const).map((field, i) => q(`${ac}.${field}`, ['What separate AC rate applies per unit?', 'What does an hour of AC use cost?', 'What is the separate monthly AC charge?'][i], 'number', OFFER, true, [], 'INR before splitting.', { [`${ac}.available`]: [true], [`${ac}.billing_method`]: [['separate_per_kwh', 'separate_per_hour', 'separate_fixed_monthly'][i]] })),
      ...splits(`${ac}.split`, acCharged),
      q(`${ac}.notes`, 'Any other cooling details the tenant should know?', 'text', OFFER, false, [], '', { [`${ac}.available`]: [true, false] }),
    ] },
    { id: 'media', title: 'Bring your profile and home to life', questions: (['profile', 'property'] as const).flatMap(target => [
      { ...q(`media.${target}.photos`, 'Add 3–6 photos.', 'photos', target === 'profile' ? ALL : OFFER, true), minimum_files: 3, maximum_files: 6, upload_endpoint: `/api/media/${target}/photos`, accepted_types: ['image/jpeg', 'image/png', 'image/webp'] },
      { ...q(`media.${target}.video`, 'Add an optional short video.', 'video', target === 'profile' ? ALL : OFFER), minimum_files: 0, maximum_files: 1, upload_endpoint: `/api/media/${target}/video`, accepted_types: ['video/mp4', 'video/webm'] },
    ]) },
  ],
};
