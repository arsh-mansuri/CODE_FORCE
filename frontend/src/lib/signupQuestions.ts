import type { Questionnaire } from '../types/onboarding';
import { questionVisible } from './onboardingValidation';

// Five account questions plus five housing questions for either category.
export const SIGNUP_FIELDS = new Set([
  'email', 'password', 'profile.full_name', 'profile.age', 'profile.intents',
  'profile.search.location.city', 'profile.search.budget', 'profile.search.property_types',
  'profile.search.move_in_from', 'profile.search.move_in_by',
  'offering.property_type', 'offering.provider_relationship', 'offering.location',
  'offering.monthly_rent', 'offering.available_from',
]);

export function signupSteps(questionnaire: Questionnaire, answers: Record<string, unknown>) {
  return questionnaire.sections.flatMap(section => section.questions
    .filter(question => SIGNUP_FIELDS.has(question.field) && questionVisible(question, answers))
    .map(question => ({ question, section: section.title })));
}
