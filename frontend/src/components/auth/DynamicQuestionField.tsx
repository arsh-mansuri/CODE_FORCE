import { useState } from 'react';
import type { Question } from '../../types/onboarding';
import { minimumDate } from '../../lib/dates';
import { numberLimits } from '../../lib/onboardingValidation';
import { INTENT_GROUPS, selectedIntents, toggleIntent } from '../../lib/intents';

interface DynamicQuestionFieldProps {
  question: Question;
  value: any;
  onChange: (value: any) => void;
  allAnswers: Record<string, any>;
  disabled?: boolean;
}

const intentLabels: Record<string, [string, string, string]> = {
  seek_roommate: ['Find my people', 'Meet a roommate and find a home together.', 'group_add'],
  seek_room: ['Find a room', 'Join a home that already has good company.', 'meeting_room'],
  seek_entire_home: ['Find a whole home', 'A place to make entirely your own.', 'home'],
  offer_shared_home: ['Share my home', 'Find the right person for your spare room.', 'key'],
  offer_entire_home: ['List my property', 'Connect your home with its next chapter.', 'apartment'],
};

const humanize = (text: string) => text.replaceAll('_', ' ').replace(/^./, c => c.toUpperCase());

export function DynamicQuestionField({ question: q, value, onChange, allAnswers, disabled = false }: DynamicQuestionFieldProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [listText, setListText] = useState<string | null>(null);
  const common = { id: q.field, required: q.required, disabled, 'aria-label': q.prompt };
  const structuredList = q.field === 'profile.search.location.nearby' || q.field === 'offering.nearby_landmarks';
  const isIntent = q.field === 'profile.intents';

  return <fieldset className="question-input" disabled={disabled} aria-label={q.prompt}>
    {(q.input_type === 'text' || q.input_type === 'email') && (
      q.field === 'profile.bio' || q.field === 'offering.description' || q.field.endsWith('.notes') || q.field.endsWith('custom_details')
        ? <textarea {...common} rows={5} maxLength={q.field === 'offering.description' ? 3000 : q.field === 'profile.bio' ? 1000 : 500} value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder="In your own words…" />
        : <input {...common} type={q.input_type} value={value ?? ''} onChange={e => onChange(e.target.value)} autoComplete={q.input_type === 'email' ? 'email' : q.field === 'profile.full_name' ? 'name' : 'off'}
          maxLength={q.input_type === 'email' ? 320 : q.field === 'offering.title' ? 160 : 100} minLength={q.field === 'offering.title' ? 3 : undefined}
          placeholder={q.input_type === 'email' ? 'you@example.com' : 'Type here…'} />
    )}
    {q.input_type === 'password' && <div className="password-input">
      <input {...common} type={showPassword ? 'text' : 'password'} value={value ?? ''} onChange={e => onChange(e.target.value)} minLength={10} maxLength={128} autoComplete="new-password" />
      <button type="button" className="text-button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Hide' : 'Show'}</button>
    </div>}
    {q.input_type === 'number' && <input {...common} type="number" {...numberLimits(q.field)} value={value ?? ''} onChange={e => onChange(e.target.value === '' ? undefined : Number(e.target.value))} />}
    {q.input_type === 'date' && <>
      <input {...common} type="date" min={minimumDate(q.field, allAnswers)} value={value ?? ''} onChange={e => onChange(e.target.value)} />
      <p className="input-hint">Today or later. {q.field.endsWith('move_in_by') && 'On or after your earliest move-in date.'}</p>
    </>}
    {isIntent && <div className="intent-groups">
      {INTENT_GROUPS.map(group => <fieldset className="intent-group" key={group.label}>
        <legend>{group.label}</legend><p>{group.description}</p>
        <div className="intent-choices">{group.values.map(intent => {
          const selected = (value || []).includes(intent);
          const meta = intentLabels[intent];
          return <button type="button" key={intent} className={`choice-button intent-choice ${selected ? 'is-selected' : ''}`} aria-pressed={selected} onClick={() => onChange(toggleIntent(value || [], intent))}>
            <span className="material-symbols-outlined" aria-hidden="true">{meta[2]}</span>
            <span className="intent-copy"><strong>{meta[0]}</strong><small>{meta[1]}</small></span>
            <span className={`intent-checkbox ${selected ? 'is-checked' : ''}`} aria-hidden="true">{selected && <span className="material-symbols-outlined">check</span>}</span>
          </button>;
        })}</div>
      </fieldset>)}
      <p className="input-hint" role="status">{value?.length || 0} selected · Choose one or more within a category.</p>
    </div>}
    {!isIntent && (q.input_type === 'single_choice' || q.input_type === 'multi_choice') && <div className="choice-grid">
      {q.options.filter(option => q.field !== 'offering.kind' || selectedIntents(allAnswers).includes(option.value === 'entire_home' ? 'offer_entire_home' : 'offer_shared_home')).map(option => {
        const selected = q.input_type === 'multi_choice' ? (value || []).includes(option.value) : value === option.value;
        return <button key={option.value} type="button" aria-pressed={selected} className={`choice-button ${selected ? 'is-selected' : ''}`}
          onClick={() => onChange(q.input_type === 'multi_choice' ? selected ? value.filter((item: string) => item !== option.value) : [...(value || []), option.value] : option.value)}>
          {option.label}
        </button>;
      })}
    </div>}
    {q.input_type === 'boolean' && <div className="choice-grid">
      {[true, false].map(choice => <button key={String(choice)} type="button" className={`choice-button ${value === choice ? 'is-selected' : ''}`} aria-pressed={value === choice} onClick={() => onChange(choice)}>{choice ? 'Yes' : 'No'}</button>)}
      {!q.required && <button type="button" className={`choice-button ${value == null ? 'is-selected' : ''}`} aria-pressed={value == null} onClick={() => onChange(null)}>No preference / not sure</button>}
    </div>}
    {q.input_type === 'scale' && <>
      <div className="scale-choices">{[1, 2, 3, 4, 5].map(level => <button key={level} type="button" className={`choice-button ${value === level ? 'is-selected' : ''}`} aria-pressed={value === level} onClick={() => onChange(level)}>{level}</button>)}</div>
      <div className="scale-labels"><span>Low / relaxed</span><span>High / frequent</span></div>
    </>}
    {q.input_type === 'list' && !structuredList && <>
      <input {...common} type="text" value={listText ?? (Array.isArray(value) ? value.join(', ') : value ?? '')} onChange={e => {
        setListText(e.target.value); onChange(e.target.value.split(',').map(item => item.trim()).filter(Boolean));
      }} placeholder="Separate items with commas" />
      <p className="input-hint">Separate each item with a comma. Leave empty for no preference.</p>
    </>}
    {q.input_type === 'list' && structuredList && <div className="landmark-list">
      {(value || []).map((item: Record<string, any>, index: number) => {
        const patch = (update: Record<string, unknown>) => onChange(value.map((row: object, i: number) => i === index ? { ...row, ...update } : row));
        const search = q.field === 'profile.search.location.nearby';
        return <div className="landmark-row" key={index}>
          <label className="flow-label">Type<select value={item.kind} onChange={e => patch({ kind: e.target.value })}>{(q.options.length ? q.options : [{ value: 'public_transport', label: 'Public transport' }, { value: 'grocery', label: 'Grocery' }, { value: 'park', label: 'Park' }]).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label className="flow-label">Place name {search && '(optional)'}<input type="text" value={item.name || ''} maxLength={120} required={!search} onChange={e => patch({ name: e.target.value || null })} /></label>
          <label className="flow-label">{search ? 'Maximum distance (km)' : 'Distance (km)'}<input type="number" min={search ? 0.1 : 0} max={search ? 50 : 100} step="0.1" required value={item[search ? 'max_distance_km' : 'distance_km'] ?? ''} onChange={e => patch({ [search ? 'max_distance_km' : 'distance_km']: e.target.value === '' ? '' : Number(e.target.value) })} /></label>
          {search && <label className="flow-label">Importance<select value={item.importance} onChange={e => patch({ importance: e.target.value })}><option value="preferred">Nice to have</option><option value="required">Must have</option></select></label>}
          <button type="button" className="text-button" onClick={() => onChange(value.filter((_: unknown, i: number) => i !== index))}>Remove place</button>
        </div>;
      })}
      <button type="button" className="secondary-button" disabled={(value?.length || 0) >= 10} onClick={() => onChange([...(value || []), { kind: 'public_transport', name: '', ...(q.field === 'profile.search.location.nearby' ? { max_distance_km: 3, importance: 'preferred' } : { distance_km: 1 }) }])}>Add a nearby place</button>
    </div>}
    {q.input_type === 'object' && q.field === 'profile.search.budget' && <div className="paired-inputs">
      {(['minimum', 'maximum'] as const).map(key => <label className="flow-label" key={key}>{key === 'minimum' ? 'From (₹/month)' : 'Up to (₹/month)'}<input type="number" min={key === 'minimum' ? 0 : 0.01} max={10000000} step="0.01" required value={value?.[key] ?? ''} onChange={e => onChange({ ...value, [key]: e.target.value === '' ? undefined : Number(e.target.value) })} /></label>)}
    </div>}
    {q.input_type === 'object' && q.field === 'offering.location' && <>
      {['city', 'area', 'pincode'].map(key => <label className="flow-label" key={key}>{key === 'area' ? 'Neighbourhood' : key === 'pincode' ? 'PIN code' : 'City'}<input type="text" required maxLength={key === 'pincode' ? 6 : 120} pattern={key === 'pincode' ? '[1-9][0-9]{5}' : undefined} inputMode={key === 'pincode' ? 'numeric' : 'text'} value={value?.[key] ?? ''} onChange={e => onChange({ ...value, [key]: e.target.value })} /></label>)}
    </>}
    {q.input_type === 'object' && ['profile.room_priorities', 'profile.compatibility_weights'].includes(q.field) && <div className="priority-list">
      {(q.field === 'profile.room_priorities' ? ['size', 'private_bathroom', 'balcony', 'natural_light', 'quiet'] : ['cleanliness', 'social_energy', 'guests', 'noise_tolerance', 'sleep_schedule', 'work_style', 'diet', 'smokes', 'has_pets']).map(key => <label key={key} className="priority-row">
        <span>{humanize(key)}<strong>{value?.[key] ?? 3}/5</strong></span><input aria-label={humanize(key)} type="range" min={0} max={5} step={1} value={value?.[key] ?? 3} onChange={e => onChange({ ...value, [key]: Number(e.target.value) })} />
      </label>)}
      <p className="input-hint">0 = not important · 5 = very important</p>
    </div>}
  </fieldset>;
}
