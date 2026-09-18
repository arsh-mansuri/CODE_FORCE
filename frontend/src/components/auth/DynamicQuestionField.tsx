import React, { useState } from 'react';
import type { Question } from '../../types/onboarding';

interface DynamicQuestionFieldProps {
  question: Question;
  value: any;
  onChange: (val: any) => void;
  allAnswers?: Record<string, any>;
}

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=800&auto=format&fit=crop&q=80',
];

const INTENT_META: Record<string, { title: string; subtitle: string; icon: string }> = {
  seek_roommate: {
    title: 'Seek Roommate',
    subtitle: 'Team up with a compatible flatmate to search together',
    icon: 'group_add',
  },
  seek_room: {
    title: 'Seek Room',
    subtitle: 'Move into a vacant room in an existing verified flatshare',
    icon: 'meeting_room',
  },
  seek_entire_home: {
    title: 'Seek Entire Home',
    subtitle: 'Rent an entire apartment or house directly from provider',
    icon: 'home',
  },
  offer_shared_home: {
    title: 'Offer Shared Flat',
    subtitle: 'Fill a vacant room in your current co-living space',
    icon: 'key',
  },
  offer_entire_home: {
    title: 'Offer Entire Property',
    subtitle: 'List an entire home or townhouse for tenancy',
    icon: 'apartment',
  },
};

export const DynamicQuestionField: React.FC<DynamicQuestionFieldProps> = ({
  question,
  value,
  onChange,
  allAnswers,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  // If gender_description is rendered, only show if gender is 'self_described'
  if (
    question.field === 'profile.gender_description' &&
    allAnswers?.['profile.gender'] !== 'self_described'
  ) {
    return null;
  }

  // Format used_for tags for friendly badge display
  const getBadgeLabel = (tag: string) => {
    switch (tag) {
      case 'intent_routing':
        return 'Intent Routing';
      case 'hard_filter':
        return 'Hard Filter';
      case 'weighted_cosine':
        return 'Vector Match';
      case 'irving_rankings':
        return 'Irving Stable Roommates';
      case 'rent_valuation_onboarding':
        return 'Sperner Fair-Rent';
      case 'mutual_dealbreaker':
        return 'Double Opt-In';
      case 'listing_discovery':
        return 'Listing Discovery';
      case 'profile_carousel':
        return 'Vibe Card';
      default:
        return tag.replace('_', ' ');
    }
  };

  return (
    <div
      style={{
        background: 'var(--color-surface-container-lowest)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--color-outline-variant)',
        padding: '16px 18px',
        marginBottom: '14px',
        boxShadow: '0 2px 6px rgba(32, 27, 23, 0.03)',
      }}
    >
      {/* Question Prompt Header */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
          <label
            style={{
              fontSize: '14.5px',
              fontWeight: 600,
              color: 'var(--color-on-surface)',
              lineHeight: '1.3',
            }}
          >
            {question.prompt}
          </label>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {question.required && (
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: 'var(--color-primary)',
                  background: 'rgba(146, 51, 38, 0.1)',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-full)',
                  letterSpacing: '0.02em',
                }}
              >
                Required
              </span>
            )}
            {question.used_for?.map((u) => (
              <span
                key={u}
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  color: 'var(--color-secondary)',
                  background: 'var(--color-secondary-container)',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-full)',
                }}
              >
                {getBadgeLabel(u)}
              </span>
            ))}
          </div>
        </div>

        {question.help_text && (
          <p
            style={{
              fontSize: '12px',
              color: 'var(--color-on-surface-variant)',
              marginTop: '4px',
              marginBottom: 0,
              lineHeight: '1.4',
            }}
          >
            {question.help_text}
          </p>
        )}
      </div>

      {/* Dynamic Input Renderers */}
      <div style={{ marginTop: '12px' }}>
        {/* 1. TEXT / EMAIL */}
        {(question.input_type === 'text' || question.input_type === 'email') && (
          <input
            type={question.input_type === 'email' ? 'email' : 'text'}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`Enter ${question.prompt.toLowerCase()}...`}
            required={question.required}
            style={{
              width: '100%',
              height: '44px',
              padding: '0 14px',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-outline-variant)',
              background: 'var(--color-surface)',
              fontSize: '14px',
              color: 'var(--color-on-surface)',
              outline: 'none',
            }}
          />
        )}

        {/* 2. PASSWORD */}
        {question.input_type === 'password' && (
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={value ?? ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Minimum 10 characters"
              minLength={10}
              required={question.required}
              style={{
                width: '100%',
                height: '44px',
                padding: '0 40px 0 14px',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-outline-variant)',
                background: 'var(--color-surface)',
                fontSize: '14px',
                color: 'var(--color-on-surface)',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--color-on-surface-variant)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
              }}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                {showPassword ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          </div>
        )}

        {/* 3. NUMBER */}
        {question.input_type === 'number' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => onChange(Math.max(1, (Number(value) || 0) - 1))}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface-container-high)',
                border: '1px solid var(--color-outline-variant)',
                color: 'var(--color-on-surface)',
                fontSize: '18px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              −
            </button>
            <input
              type="number"
              value={value ?? ''}
              onChange={(e) => onChange(Number(e.target.value))}
              required={question.required}
              style={{
                width: '120px',
                height: '40px',
                textAlign: 'center',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-outline-variant)',
                background: 'var(--color-surface)',
                fontSize: '15px',
                fontWeight: 600,
                color: 'var(--color-on-surface)',
              }}
            />
            <button
              type="button"
              onClick={() => onChange((Number(value) || 0) + 1)}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface-container-high)',
                border: '1px solid var(--color-outline-variant)',
                color: 'var(--color-on-surface)',
                fontSize: '18px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              +
            </button>
          </div>
        )}

        {/* 4. DATE */}
        {question.input_type === 'date' && (
          <input
            type="date"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            required={question.required}
            style={{
              width: '100%',
              height: '44px',
              padding: '0 14px',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-outline-variant)',
              background: 'var(--color-surface)',
              fontSize: '14px',
              color: 'var(--color-on-surface)',
            }}
          />
        )}

        {/* 5. SINGLE CHOICE */}
        {question.input_type === 'single_choice' && (
          <div>
            {/* Special Intent Cards */}
            {question.field === 'profile.intent' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {question.options.map((opt) => {
                  const meta = INTENT_META[opt.value] || {
                    title: opt.label,
                    subtitle: '',
                    icon: 'explore',
                  };
                  const isSelected = value === opt.value;
                  return (
                    <div
                      key={opt.value}
                      onClick={() => onChange(opt.value)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 'var(--radius-xl)',
                        border: isSelected
                          ? '2px solid var(--color-primary)'
                          : '1px solid var(--color-outline-variant)',
                        background: isSelected
                          ? 'rgba(146, 51, 38, 0.05)'
                          : 'var(--color-surface)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          background: isSelected ? 'var(--color-primary)' : 'var(--color-surface-container-high)',
                          color: isSelected ? '#ffffff' : 'var(--color-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                          {meta.icon}
                        </span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-on-surface)' }}>
                          {meta.title}
                        </div>
                        {meta.subtitle && (
                          <div style={{ fontSize: '11.5px', color: 'var(--color-on-surface-variant)', marginTop: '2px' }}>
                            {meta.subtitle}
                          </div>
                        )}
                      </div>
                      <div
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          border: isSelected ? '5px solid var(--color-primary)' : '2px solid var(--color-outline-variant)',
                          background: '#ffffff',
                          flexShrink: 0,
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Standard Pill Options */
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {question.options.map((opt) => {
                  const isSelected = value === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onChange(opt.value)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 'var(--radius-full)',
                        border: isSelected
                          ? '1.5px solid var(--color-primary)'
                          : '1px solid var(--color-outline-variant)',
                        background: isSelected
                          ? 'rgba(146, 51, 38, 0.08)'
                          : 'var(--color-surface)',
                        color: isSelected ? 'var(--color-primary)' : 'var(--color-on-surface)',
                        fontSize: '13px',
                        fontWeight: isSelected ? 700 : 500,
                        cursor: 'pointer',
                        transition: 'all 0.12s ease',
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 6. MULTI CHOICE */}
        {question.input_type === 'multi_choice' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {question.options.map((opt) => {
              const currentList: string[] = Array.isArray(value) ? value : [];
              const isSelected = currentList.includes(opt.value);
              const toggle = () => {
                if (isSelected) {
                  onChange(currentList.filter((v) => v !== opt.value));
                } else {
                  onChange([...currentList, opt.value]);
                }
              };

              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={toggle}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-full)',
                    border: isSelected
                      ? '1.5px solid var(--color-secondary)'
                      : '1px solid var(--color-outline-variant)',
                    background: isSelected
                      ? 'var(--color-secondary-container)'
                      : 'var(--color-surface)',
                    color: isSelected
                      ? 'var(--color-on-secondary-container)'
                      : 'var(--color-on-surface)',
                    fontSize: '13px',
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                    {isSelected ? 'check_circle' : 'add_circle'}
                  </span>
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* 7. SCALE (1-5 Tactile Rating) */}
        {question.input_type === 'scale' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px', marginBottom: '8px' }}>
              {[1, 2, 3, 4, 5].map((level) => {
                const isSelected = Number(value) === level;
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => onChange(level)}
                    style={{
                      flex: 1,
                      height: '40px',
                      borderRadius: 'var(--radius-md)',
                      border: isSelected
                        ? '2px solid var(--color-primary)'
                        : '1px solid var(--color-outline-variant)',
                      background: isSelected
                        ? 'var(--color-primary)'
                        : 'var(--color-surface)',
                      color: isSelected ? '#ffffff' : 'var(--color-on-surface)',
                      fontWeight: 700,
                      fontSize: '15px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {level}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-on-surface-variant)' }}>
              <span>1: Low / Relaxed</span>
              <span>3: Balanced</span>
              <span>5: High / Strict</span>
            </div>
          </div>
        )}

        {/* 8. BOOLEAN */}
        {question.input_type === 'boolean' && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={() => onChange(true)}
              style={{
                flex: 1,
                height: '40px',
                borderRadius: 'var(--radius-lg)',
                border: value === true
                  ? '2px solid var(--color-secondary)'
                  : '1px solid var(--color-outline-variant)',
                background: value === true
                  ? 'var(--color-secondary-container)'
                  : 'var(--color-surface)',
                color: value === true
                  ? 'var(--color-on-secondary-container)'
                  : 'var(--color-on-surface)',
                fontWeight: 700,
                fontSize: '13.5px',
                cursor: 'pointer',
              }}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => onChange(false)}
              style={{
                flex: 1,
                height: '40px',
                borderRadius: 'var(--radius-lg)',
                border: value === false
                  ? '2px solid var(--color-primary)'
                  : '1px solid var(--color-outline-variant)',
                background: value === false
                  ? 'rgba(146, 51, 38, 0.1)'
                  : 'var(--color-surface)',
                color: value === false
                  ? 'var(--color-primary)'
                  : 'var(--color-on-surface)',
                fontWeight: 700,
                fontSize: '13.5px',
                cursor: 'pointer',
              }}
            >
              No
            </button>
          </div>
        )}

        {/* 9. LIST */}
        {question.input_type === 'list' && (
          <div>
            <input
              type="text"
              value={Array.isArray(value) ? value.join(', ') : (value ?? '')}
              onChange={(e) => {
                const list = e.target.value.split(',').map((s) => s.trim());
                onChange(list);
              }}
              placeholder="Separate items with commas..."
              style={{
                width: '100%',
                height: '44px',
                padding: '0 14px',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-outline-variant)',
                background: 'var(--color-surface)',
                fontSize: '14px',
                color: 'var(--color-on-surface)',
              }}
            />
            {question.field.includes('location.areas') && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                {['Navrangpura', 'Vastrapur', 'Bodakdev', 'SG Highway', 'Satellite'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      const cur = Array.isArray(value) ? value : [];
                      if (!cur.includes(s)) onChange([...cur, s]);
                    }}
                    style={{
                      fontSize: '11px',
                      padding: '3px 8px',
                      borderRadius: 'var(--radius-full)',
                      background: 'var(--color-surface-container-high)',
                      border: '1px solid var(--color-outline-variant)',
                      color: 'var(--color-on-surface)',
                      cursor: 'pointer',
                    }}
                  >
                    + {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 10. OBJECT (Budget, Location, Priorities) */}
        {question.input_type === 'object' && (
          <div>
            {/* Budget Range */}
            {question.field === 'profile.search.budget' && (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>
                    MIN (₹/MO)
                  </label>
                  <input
                    type="number"
                    value={value?.minimum ?? 6000}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        minimum: Number(e.target.value),
                      })
                    }
                    style={{
                      width: '100%',
                      height: '40px',
                      padding: '0 10px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-outline-variant)',
                      background: 'var(--color-surface)',
                      fontSize: '14px',
                      fontWeight: 600,
                    }}
                  />
                </div>
                <span style={{ marginTop: '16px', color: 'var(--color-outline)' }}>–</span>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>
                    MAX (₹/MO)
                  </label>
                  <input
                    type="number"
                    value={value?.maximum ?? 16000}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        maximum: Number(e.target.value),
                      })
                    }
                    style={{
                      width: '100%',
                      height: '40px',
                      padding: '0 10px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-outline-variant)',
                      background: 'var(--color-surface)',
                      fontSize: '14px',
                      fontWeight: 600,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Room Priorities (Sperner Fair-Rent) */}
            {question.field === 'profile.room_priorities' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { key: 'size', label: 'Room Size', icon: 'square_foot' },
                  { key: 'private_bathroom', label: 'Private Bathroom', icon: 'bathtub' },
                  { key: 'balcony', label: 'Balcony / Terrace', icon: 'balcony' },
                  { key: 'natural_light', label: 'Natural Daylight', icon: 'wb_sunny' },
                  { key: 'quiet', label: 'Quiet Courtyard', icon: 'nature_people' },
                ].map((item) => {
                  const currentVal = value?.[item.key] ?? 3;
                  return (
                    <div
                      key={item.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-outline-variant)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-primary)' }}>
                          {item.icon}
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: 600 }}>{item.label}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {[1, 2, 3, 4, 5].map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => onChange({ ...value, [item.key]: p })}
                            style={{
                              width: '26px',
                              height: '26px',
                              borderRadius: '4px',
                              border: currentVal === p ? '2px solid var(--color-secondary)' : '1px solid var(--color-outline-variant)',
                              background: currentVal === p ? 'var(--color-secondary)' : 'transparent',
                              color: currentVal === p ? '#ffffff' : 'var(--color-on-surface)',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Offering Location */}
            {question.field === 'offering.location' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600 }}>City</label>
                  <input
                    type="text"
                    value={value?.city ?? 'Ahmedabad'}
                    onChange={(e) => onChange({ ...value, city: e.target.value })}
                    style={{ width: '100%', height: '36px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--color-outline-variant)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600 }}>Area</label>
                  <input
                    type="text"
                    value={value?.area ?? 'Navrangpura'}
                    onChange={(e) => onChange({ ...value, area: e.target.value })}
                    style={{ width: '100%', height: '36px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--color-outline-variant)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600 }}>PIN Code</label>
                  <input
                    type="text"
                    value={value?.pincode ?? '380009'}
                    onChange={(e) => onChange({ ...value, pincode: e.target.value })}
                    style={{ width: '100%', height: '36px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--color-outline-variant)' }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* 11. PHOTOS */}
        {question.input_type === 'photos' && (
          <div>
            <div style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', marginBottom: '8px' }}>
              Select your cover profile photo ({question.minimum_files ?? 3}–{question.maximum_files ?? 6} photos supported):
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {AVATAR_PRESETS.map((preset, idx) => {
                const isSelected = Array.isArray(value) ? value[0] === preset : value === preset;
                return (
                  <div
                    key={idx}
                    onClick={() => onChange([preset])}
                    style={{
                      position: 'relative',
                      aspectRatio: '1',
                      borderRadius: 'var(--radius-lg)',
                      overflow: 'hidden',
                      border: isSelected ? '3px solid var(--color-primary)' : '1px solid var(--color-outline-variant)',
                      cursor: 'pointer',
                      boxShadow: isSelected ? '0 3px 8px rgba(146, 51, 38, 0.25)' : 'none',
                    }}
                  >
                    <img src={preset} alt={`Avatar ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    {isSelected && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '4px',
                          right: '4px',
                          background: 'var(--color-primary)',
                          color: '#ffffff',
                          borderRadius: '50%',
                          width: '20px',
                          height: '20px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                          check
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {question.upload_endpoint && (
              <div
                style={{
                  marginTop: '8px',
                  fontSize: '11px',
                  color: 'var(--color-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                  cloud_upload
                </span>
                <span>Uploads enabled to: {question.upload_endpoint}</span>
              </div>
            )}
          </div>
        )}

        {/* 12. VIDEO */}
        {question.input_type === 'video' && (
          <div
            style={{
              padding: '12px',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--color-surface)',
              border: '1px dashed var(--color-outline-variant)',
              textAlign: 'center',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '28px', color: 'var(--color-primary)' }}>
              videocam
            </span>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface)', marginTop: '4px' }}>
              60-Second Video Introduction
            </div>
            <p style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)', margin: '4px 0 0' }}>
              Optional. Introduce yourself and your daily co-living rhythm.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
