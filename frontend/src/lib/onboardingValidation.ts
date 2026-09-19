import type { Question } from '../types/onboarding';
import { dateError, minimumDate } from './dates';
import { selectedIntents } from './intents';

export function numberLimits(field: string) {
  if (field === 'profile.age') return { min: 18, max: 120, step: 1 };
  if (field.endsWith('stay_months')) return { min: 1, max: 60, step: 1 };
  if (field.endsWith('available_spaces')) return { min: 1, max: 20, step: 1 };
  if (field.endsWith('split_between')) return { min: 2, max: 100, step: 1 };
  if (field.endsWith('tenant_share_percentage')) return { min: 0.01, max: 100, step: 0.01 };
  return { min: field.endsWith('monthly_rent') ? 0.01 : 0, max: 10000000, step: 0.01 };
}

export function questionVisible(question: Question, answers: Record<string, any>): boolean {
  if (question.input_type === 'photos' || question.input_type === 'video') return false;
  const goals = selectedIntents(answers);
  if (question.field === 'profile.intents' || question.field === 'profile.intent') return true;
  if (question.applies_to?.length && question.applies_to.length < 5 && !question.applies_to.some(intent => goals.includes(intent))) return false;
  if (question.field === 'profile.gender_description' && answers['profile.gender'] !== 'self_described') return false;
  if (question.field === 'offering.available_spaces' && answers['offering.kind'] === 'entire_home') return false;
  return Object.entries(question.show_when || {}).every(([field, choices]) => choices.includes(answers[field]));
}

export function validateAnswer(question: Question, answers: Record<string, any>): string | null {
  const value = answers[question.field];
  const empty = value === undefined || value === null || (typeof value === 'string' && !value.trim()) || (Array.isArray(value) && !value.length);
  if (empty) return question.required ? 'Please answer this before continuing.' : null;
  if (question.input_type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return 'Enter a valid email address.';
  if (question.input_type === 'password' && (value.length < 10 || value.length > 128)) return 'Use a password with 10–128 characters.';
  if (question.input_type === 'number') {
    const { min, max, step } = numberLimits(question.field);
    if (!Number.isFinite(Number(value)) || Number(value) < min || Number(value) > max || (step === 1 && !Number.isInteger(Number(value)))) return `Enter ${step === 1 ? 'a whole number' : 'an amount'} between ${min} and ${max}.`;
  }
  if (question.input_type === 'date') return dateError(value, minimumDate(question.field, answers));
  if (question.field === 'profile.search.budget' && (value.minimum < 0 || value.maximum <= 0 || value.minimum > value.maximum || !Number.isFinite(value.minimum) || !Number.isFinite(value.maximum))) return 'Enter a positive maximum budget at least as large as your minimum.';
  if (question.field.endsWith('.pincodes') && value.some((code: string) => !/^[1-9]\d{5}$/.test(code))) return 'Use six-digit Indian PIN codes, separated by commas.';
  if (question.field === 'offering.location' && (!value.city?.trim() || !value.area?.trim() || !/^[1-9]\d{5}$/.test(value.pincode))) return 'Add a city, neighbourhood, and valid six-digit PIN code.';
  if (question.field === 'profile.compatibility_weights' && !Object.values(value).some(v => Number(v) > 0)) return 'Choose at least one priority above zero.';
  if (question.field === 'offering.title' && value.trim().length < 3) return 'Use at least three characters.';
  if (question.field === 'profile.search.location.nearby' || question.field === 'offering.nearby_landmarks') {
    const search = question.field.startsWith('profile.');
    for (const place of value) {
      const distance = place[search ? 'max_distance_km' : 'distance_km'];
      if (!place.kind || (!search && !place.name?.trim()) || !Number.isFinite(distance) || distance < (search ? 0.1 : 0) || distance > (search ? 50 : 100)) return 'Add a place type, valid distance, and a name for each listing landmark.';
    }
  }
  return null;
}
