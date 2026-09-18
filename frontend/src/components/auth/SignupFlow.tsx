import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import type { AuthResponse, Intent } from '../../types/auth';
import type { QuestionSection, Questionnaire } from '../../types/onboarding';
import { signup, fetchOnboardingQuestions } from '../../lib/api';
import { getDefaultAnswers, buildSignupPayload } from '../../lib/onboardingMapper';
import { DynamicQuestionField } from './DynamicQuestionField';

interface SignupFlowProps {
  onSuccess: (auth: AuthResponse) => void;
  onSwitchToLogin: () => void;
}

export const SignupFlow: React.FC<SignupFlowProps> = ({ onSuccess, onSwitchToLogin }) => {
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>(() => getDefaultAnswers());
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReviewStep, setIsReviewStep] = useState(false);

  // Fetch questionnaire on mount
  useEffect(() => {
    let isMounted = true;
    fetchOnboardingQuestions().then((q) => {
      if (isMounted) setQuestionnaire(q);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const selectedIntent: Intent = answers['profile.intent'] || 'seek_roommate';

  // Filter sections that have questions applicable to the current intent
  const visibleSections: QuestionSection[] = questionnaire
    ? questionnaire.sections
        .map((sec) => ({
          ...sec,
          questions: sec.questions.filter(
            (q) => !q.applies_to || q.applies_to.includes(selectedIntent)
          ),
        }))
        .filter((sec) => sec.questions.length > 0)
    : [];

  const activeSection = visibleSections[currentSectionIndex];
  const totalSteps = visibleSections.length + 1; // + 1 for Live Review step
  const currentStepNumber = isReviewStep ? totalSteps : currentSectionIndex + 1;

  const handleAnswerChange = (field: string, val: any) => {
    setAnswers((prev) => ({
      ...prev,
      [field]: val,
    }));
  };

  // 1-Click Quick Fill Presets for Presentation / Speed
  const handleQuickFill = (preset: 'seeker' | 'provider') => {
    setError(null);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 37);

    if (preset === 'seeker') {
      setAnswers((prev) => ({
        ...prev,
        email: 'diya.designer@example.com',
        password: 'PropVibe-demo-2026',
        'profile.full_name': 'Diya Sharma',
        'profile.age': 25,
        'profile.gender': 'woman',
        'profile.occupation': 'Spatial & Interior Designer',
        'profile.bio': 'Calm, early riser who loves brewing pour-over coffee, propagating monstera cuttings, and keeping common spaces tidy.',
        'profile.intent': 'seek_roommate',
        'profile.search.location.city': 'Ahmedabad',
        'profile.search.location.areas': ['Navrangpura', 'Vastrapur'],
        'profile.search.location.pincodes': ['380009', '380015'],
        'profile.search.budget': { minimum: 8000, maximum: 18000 },
        'profile.search.property_types': ['2bhk', '3bhk'],
        'profile.search.move_in_from': nextWeek.toISOString().split('T')[0],
        'profile.search.move_in_by': nextMonth.toISOString().split('T')[0],
        'profile.search.stay_months': 12,
        'profile.lifestyle.cleanliness': 5,
        'profile.lifestyle.social_energy': 3,
        'profile.lifestyle.guests': 2,
        'profile.lifestyle.noise_tolerance': 2,
        'profile.lifestyle.sleep_schedule': 'early_bird',
        'profile.lifestyle.work_style': 'hybrid',
        'profile.lifestyle.diet': 'vegetarian',
        'profile.lifestyle.smokes': false,
        'profile.lifestyle.has_pets': false,
        'profile.room_priorities': {
          size: 4,
          private_bathroom: 5,
          balcony: 3,
          natural_light: 4,
          quiet: 4,
        },
      }));
    } else {
      setAnswers((prev) => ({
        ...prev,
        email: 'kabir.flat@example.com',
        password: 'PropVibe-demo-2026',
        'profile.full_name': 'Kabir Desai',
        'profile.age': 28,
        'profile.gender': 'man',
        'profile.occupation': 'Architect & 3D Visualizer',
        'profile.bio': 'Offering a master bedroom in our sunlit 3BHK flat near SG Highway. Seeking a tidy flatmate who values quiet evenings.',
        'profile.intent': 'offer_shared_home',
        'offering.title': 'Sunlit Master Bedroom in 3BHK Flat',
        'offering.description': 'En-suite bath, balcony access, high-speed Wi-Fi, modern kitchen.',
        'offering.kind': 'private_room',
        'offering.property_type': '3bhk',
        'offering.provider_relationship': 'tenant',
        'offering.location': {
          city: 'Ahmedabad',
          area: 'Bodakdev',
          pincode: '380054',
        },
        'offering.monthly_rent': 14000,
        'offering.deposit': 14000,
        'offering.available_from': nextWeek.toISOString().split('T')[0],
        'offering.minimum_stay_months': 6,
        'offering.available_spaces': 1,
        'offering.furnishing': 'furnished',
        'offering.amenities': ['attached_bath', 'balcony', 'wi_fi', 'in_unit_laundry'],
        'profile.lifestyle.cleanliness': 4,
        'profile.lifestyle.social_energy': 3,
        'profile.lifestyle.guests': 2,
        'profile.lifestyle.noise_tolerance': 3,
        'profile.lifestyle.sleep_schedule': 'flexible',
        'profile.lifestyle.work_style': 'remote',
        'profile.lifestyle.diet': 'vegetarian',
        'profile.lifestyle.smokes': false,
        'profile.lifestyle.has_pets': false,
      }));
    }
  };

  // Step Validation
  const validateCurrentSection = (): boolean => {
    setError(null);
    if (!activeSection) return true;

    for (const q of activeSection.questions) {
      if (q.required) {
        const val = answers[q.field];
        if (val === undefined || val === null || val === '') {
          setError(`Please answer: "${q.prompt}"`);
          return false;
        }
        if (q.input_type === 'email' && !String(val).includes('@')) {
          setError('Please enter a valid email address.');
          return false;
        }
        if (q.input_type === 'password' && String(val).length < 10) {
          setError('Password must be at least 10 characters.');
          return false;
        }
        if (q.input_type === 'number' && Number(val) < 18 && q.field === 'profile.age') {
          setError('PropVibe is for adults aged 18 and above.');
          return false;
        }
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateCurrentSection()) return;

    if (currentSectionIndex < visibleSections.length - 1) {
      setCurrentSectionIndex((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setIsReviewStep(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    setError(null);
    if (isReviewStep) {
      setIsReviewStep(false);
      setCurrentSectionIndex(visibleSections.length - 1);
    } else if (currentSectionIndex > 0) {
      setCurrentSectionIndex((prev) => prev - 1);
    }
  };

  // Submit dynamic signup payload to backend API
  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      const payload = buildSignupPayload(answers);
      const auth = await signup(payload);

      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#923326', '#2a6a48', '#ffdad4', '#aceec4'],
      });

      onSuccess(auth);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Registration failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!questionnaire) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid var(--color-outline-variant)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ marginTop: '12px', fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>
          Loading dynamic questionnaire...
        </p>
      </div>
    );
  }

  const selectedPhoto = Array.isArray(answers['media.profile.photos'])
    ? answers['media.profile.photos'][0]
    : answers['media.profile.photos'];

  return (
    <div style={{ width: '100%', padding: '0 20px 40px' }}>
      {/* 1-Click Demo Presets Bar */}
      <div
        style={{
          marginBottom: '16px',
          padding: '10px 12px',
          borderRadius: 'var(--radius-lg)',
          background: 'rgba(42, 106, 72, 0.08)',
          border: '1px solid rgba(42, 106, 72, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          ⚡ 1-Click Demo Fill:
        </span>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={() => handleQuickFill('seeker')}
            style={{
              padding: '3px 10px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--color-surface-container-lowest)',
              border: '1px solid var(--color-outline-variant)',
              color: 'var(--color-primary)',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Seeker Profile
          </button>
          <button
            type="button"
            onClick={() => handleQuickFill('provider')}
            style={{
              padding: '3px 10px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--color-surface-container-lowest)',
              border: '1px solid var(--color-outline-variant)',
              color: 'var(--color-secondary)',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Provider Flat
          </button>
        </div>
      </div>

      {/* Dynamic Progress Indicator */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-primary)' }}>
            Step {currentStepNumber} of {totalSteps}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>
            {isReviewStep ? 'Live Vibe Card Review' : activeSection?.title}
          </span>
        </div>
        <div style={{ height: '4px', background: 'var(--color-outline-variant)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              background: 'var(--color-primary)',
              width: `${(currentStepNumber / totalSteps) * 100}%`,
              transition: 'width 0.25s ease',
            }}
          />
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div
          style={{
            padding: '10px 14px',
            background: 'var(--color-error-container)',
            color: 'var(--color-on-error-container)',
            borderRadius: 'var(--radius-lg)',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '16px',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
            error
          </span>
          <span>{error}</span>
        </div>
      )}

      {/* STEP VIEW: Dynamic Questionnaire Section */}
      {!isReviewStep && activeSection && (
        <div>
          <div style={{ marginBottom: '16px' }}>
            <h3 className="font-serif" style={{ fontSize: '22px', fontWeight: 600, color: 'var(--color-on-surface)', margin: '0 0 4px' }}>
              {activeSection.title}
            </h3>
            {currentSectionIndex === 0 && questionnaire.introduction && (
              <p style={{ fontSize: '12.5px', color: 'var(--color-on-surface-variant)', lineHeight: '1.4', margin: 0 }}>
                {questionnaire.introduction}
              </p>
            )}
          </div>

          {/* Dynamic Question List for this section */}
          <div>
            {activeSection.questions.map((question) => (
              <DynamicQuestionField
                key={question.field}
                question={question}
                value={answers[question.field]}
                onChange={(val) => handleAnswerChange(question.field, val)}
                allAnswers={answers}
              />
            ))}
          </div>
        </div>
      )}

      {/* STEP VIEW: Live Vibe Discovery Card Review */}
      {isReviewStep && (
        <div>
          <div style={{ marginBottom: '16px' }}>
            <h3 className="font-serif" style={{ fontSize: '22px', fontWeight: 600, color: 'var(--color-on-surface)', margin: '0 0 4px' }}>
              Your Tinder for PropTech Vibe Card
            </h3>
            <p style={{ fontSize: '12.5px', color: 'var(--color-on-surface-variant)', lineHeight: '1.4', margin: 0 }}>
              Here is how your profile and housing intent appear to potential roommates and providers in the matching feed.
            </p>
          </div>

          {/* Rendered Dynamic Profile Card */}
          <div
            style={{
              background: 'var(--color-surface-container-lowest)',
              borderRadius: 'var(--radius-2xl)',
              border: '1px solid var(--color-outline-variant)',
              padding: '16px',
              boxShadow: 'var(--shadow-warm)',
              marginBottom: '20px',
            }}
          >
            {/* Header / Avatar */}
            <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '14px' }}>
              <img
                src={selectedPhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80'}
                alt="Profile Preview"
                style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-primary)' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <h4 className="font-serif" style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>
                    {answers['profile.full_name'] || 'You'}, {answers['profile.age']}
                  </h4>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-secondary)' }}>
                    verified_user
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)', marginTop: '2px' }}>
                  {answers['profile.occupation'] || 'Creative Co-Living Seeker'}
                </div>
                <span
                  style={{
                    display: 'inline-block',
                    marginTop: '4px',
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--color-secondary)',
                    background: 'var(--color-secondary-container)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                  }}
                >
                  {selectedIntent.replace(/_/g, ' ')}
                </span>
              </div>
            </div>

            {/* Bio */}
            {answers['profile.bio'] && (
              <blockquote
                className="font-serif"
                style={{
                  fontSize: '14px',
                  fontStyle: 'italic',
                  color: 'var(--color-on-surface)',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-surface)',
                  borderLeft: '3px solid var(--color-primary)',
                  margin: '0 0 14px',
                }}
              >
                “{answers['profile.bio']}”
              </blockquote>
            )}

            {/* Habit Vector Chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: 'var(--radius-full)', background: 'rgba(178, 74, 59, 0.08)', color: 'var(--color-primary)' }}>
                Cleanliness {answers['profile.lifestyle.cleanliness'] ?? 4}/5
              </span>
              <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: 'var(--radius-full)', background: 'var(--color-secondary-container)', color: 'var(--color-on-secondary-container)' }}>
                Social {answers['profile.lifestyle.social_energy'] ?? 3}/5
              </span>
              <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: 'var(--radius-full)', background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)' }}>
                {answers['profile.lifestyle.sleep_schedule'] === 'early_bird' ? '🌅 Early Bird' : answers['profile.lifestyle.sleep_schedule'] === 'night_owl' ? '🦉 Night Owl' : '☕ Flexible'}
              </span>
              <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: 'var(--radius-full)', background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)' }}>
                🥗 {answers['profile.lifestyle.diet'] ?? 'Vegetarian'}
              </span>
              {answers['profile.search.budget'] && (
                <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: 'var(--radius-full)', background: 'rgba(146, 51, 38, 0.1)', color: 'var(--color-primary)' }}>
                  ₹{answers['profile.search.budget'].minimum}–₹{answers['profile.search.budget'].maximum}/mo
                </span>
              )}
            </div>

            {/* Sperner Room Priorities Summary */}
            <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: '10px 12px', border: '1px solid var(--color-outline-variant)' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                Rent Harmony Fair-Rent Seed
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: 'var(--color-on-surface-variant)' }}>
                <span>Size: {answers['profile.room_priorities']?.size ?? 3}/5</span>
                <span>Bath: {answers['profile.room_priorities']?.private_bathroom ?? 4}/5</span>
                <span>Balcony: {answers['profile.room_priorities']?.balcony ?? 2}/5</span>
                <span>Light: {answers['profile.room_priorities']?.natural_light ?? 3}/5</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Button Controls */}
      <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
        {(currentSectionIndex > 0 || isReviewStep) && (
          <button
            type="button"
            onClick={handleBack}
            disabled={loading}
            style={{
              flex: 1,
              height: '48px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--color-outline-variant)',
              background: 'var(--color-surface-container-lowest)',
              color: 'var(--color-on-surface)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Back
          </button>
        )}

        {!isReviewStep ? (
          <button
            type="button"
            onClick={handleNext}
            style={{
              flex: 2,
              height: '48px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--color-primary)',
              color: '#ffffff',
              fontSize: '14.5px',
              fontWeight: 700,
              boxShadow: 'var(--shadow-warm)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <span>Continue</span>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              arrow_forward
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            style={{
              flex: 2,
              height: '48px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--color-primary)',
              color: '#ffffff',
              fontSize: '15px',
              fontWeight: 700,
              boxShadow: 'var(--shadow-warm)',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.8 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {loading ? (
              <>
                <div style={{ width: '18px', height: '18px', border: '2px solid #ffffff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <span>Creating Account...</span>
              </>
            ) : (
              <>
                <span>Complete Signup</span>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  check_circle
                </span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Switch to Login Link */}
      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        <span style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>
          Already have an account?{' '}
        </span>
        <button
          type="button"
          onClick={onSwitchToLogin}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-primary)',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          Sign In
        </button>
      </div>
    </div>
  );
};
