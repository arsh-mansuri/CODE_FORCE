import type { AuthResponse, LoginRequest, SignupRequest, UserProfile, MediaResponse } from '../types/auth';
import type { FeedQueryParams, FeedResponse, Candidate, SwipeRequest, SwipeResponse, ListingFeed } from '../types/feed';
import { DEMO_PERSONAS } from './demoPersonas';
import { MOCK_LISTINGS } from './mockListings';

const rawApiUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const API_BASE_URL = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl}/api`;
const TOKEN_KEY = 'propvibe_token';
const USER_KEY = 'propvibe_user';
const EXPIRY_KEY = 'propvibe_expiry';

export class ApiError extends Error {
  status: number;
  code?: string;
  field?: string;
  constructor(message: string, status: number, code?: string, field?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

export function getStoredToken(): string | null {
  const expiry = localStorage.getItem(EXPIRY_KEY);
  if (expiry && new Date(expiry).getTime() <= Date.now()) {
    clearSession();
    return null;
  }
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): UserProfile | null {
  if (!getStoredToken()) return null;
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null') as UserProfile | null;
  } catch {
    clearSession();
    return null;
  }
}

export function saveUser(user: UserProfile): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function saveSession(auth: AuthResponse): void {
  localStorage.setItem(TOKEN_KEY, auth.access_token);
  localStorage.setItem(EXPIRY_KEY, auth.expires_at);
  saveUser(auth.user);
}

export function clearSession(): void {
  [TOKEN_KEY, USER_KEY, EXPIRY_KEY].forEach(key => localStorage.removeItem(key));
}

export function mediaUrl(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  try {
    return new URL(url, new URL(API_BASE_URL, window.location.origin)).href;
  } catch {
    return url;
  }
}

async function request<T>(path: string, options: RequestInit = {}, timeout = 15000): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, { ...options, signal: controller.signal });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const field = data?.error?.fields?.[0];
      throw new ApiError(
        field ? `${data.error.message} ${field.message}` : data?.error?.message || `Request failed (${response.status}). Please try again.`,
        response.status, data?.error?.code, field?.field,
      );
    }
    if (!data) throw new ApiError('The server returned an unexpected response. Please try again.', 502);
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('Unable to reach PropVibe. Check your connection and try again.', 0);
  } finally {
    window.clearTimeout(timer);
  }
}

const jsonPost = (body: unknown): RequestInit => ({
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
const authorization = () => ({ Authorization: `Bearer ${getStoredToken()}` });

export function checkEmail(email: string): Promise<{ exists: boolean }> {
  return request('/auth/check-email', jsonPost({ email: email.trim().toLowerCase() }));
}

export function forgotPassword(email: string): Promise<{ message: string }> {
  return request('/auth/forgot-password', jsonPost({ email }));
}

export function resetPassword(token: string, password: string): Promise<{ message: string }> {
  return request('/auth/reset-password', jsonPost({ token, password }));
}

export async function login(credentials: LoginRequest, allowDemo = false): Promise<AuthResponse> {
  let auth: AuthResponse;
  try {
    auth = await request('/auth/login', jsonPost(credentials));
  } catch (error) {
    const demo = allowDemo && DEMO_PERSONAS.find(p => p.email === credentials.email && p.password === credentials.password);
    if (!(error instanceof ApiError) || (error.status !== 0 && error.status < 500) || !demo) throw error;
    auth = {
      access_token: `offline_demo_${demo.user.id}`, token_type: 'bearer',
      expires_at: new Date(Date.now() + 86400000).toISOString(), user: demo.user,
    };
  }
  saveSession(auth);
  return auth;
}

export async function signup(payload: SignupRequest): Promise<AuthResponse> {
  const auth = await request<AuthResponse>('/auth/signup', jsonPost(payload));
  saveSession(auth);
  return auth;
}

export async function logout(): Promise<void> {
  const headers = authorization();
  clearSession();
  try { await request('/auth/logout', { method: 'POST', headers }); } catch { /* Local session is already cleared. */ }
}

export async function getMe(): Promise<UserProfile | null> {
  const token = getStoredToken();
  if (!token) return null;
  if (token.startsWith('offline_demo_')) return getStoredUser();
  try {
    const user = await request<UserProfile>('/users/me', { headers: authorization() });
    saveUser(user);
    return user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      clearSession();
      return null;
    }
    return getStoredUser();
  }
}

export async function updateProfile(payload: Pick<SignupRequest, 'profile' | 'offering'>): Promise<UserProfile> {
  const token = getStoredToken();
  if (token?.startsWith('offline_demo_')) {
    const current = getStoredUser();
    if (!current) throw new ApiError('Please sign in again to edit your profile.', 401);
    const user: UserProfile = {
      ...current,
      profile: payload.profile,
      offering: current.offering && payload.offering ? { ...current.offering, ...payload.offering } : null,
    };
    saveUser(user);
    return user;
  }
  const user = await request<UserProfile>('/users/me', {
    method: 'PUT', headers: { ...authorization(), 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  saveUser(user);
  return user;
}

export async function setAccountDeletionRequested(requested: boolean): Promise<UserProfile> {
  const token = getStoredToken();
  if (token?.startsWith('offline_demo_')) {
    const current = getStoredUser();
    if (!current) throw new ApiError('Please sign in again to manage your account.', 401);
    const now = new Date();
    const user: UserProfile = {
      ...current, deletion_request: requested ? current.deletion_request || {
        requested_at: now.toISOString(), scheduled_for: new Date(now.getTime() + 7 * 86400000).toISOString(),
      } : null
    };
    saveUser(user);
    return user;
  }
  const user = await request<UserProfile>('/users/me/deletion-request', {
    method: requested ? 'POST' : 'DELETE', headers: authorization(),
  });
  saveUser(user);
  return user;
}

export async function uploadMedia(target: 'profile' | 'property', kind: 'photos' | 'video', files: File[]): Promise<MediaResponse> {
  const body = new FormData();
  files.forEach(file => body.append(kind === 'photos' ? 'files' : 'file', file));
  return request(`/media/${target}/${kind}`, { method: 'POST', headers: authorization(), body }, 120000);
}

export function deleteMedia(id: string): Promise<MediaResponse> {
  return request(`/media/items/${id}`, { method: 'DELETE', headers: authorization() });
}

export async function fetchOnboardingQuestions(): Promise<import('../types/onboarding').Questionnaire> {
  try {
    return await request('/onboarding/questions', {}, 4000);
  } catch {
    const { FALLBACK_QUESTIONNAIRE } = await import('./onboardingFallback');
    return FALLBACK_QUESTIONNAIRE;
  }
}

const DEMO_SWIPES_KEY = 'propvibe_demo_swipes';

function getDemoSwipedIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DEMO_SWIPES_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function recordDemoSwipe(targetId: string): void {
  const seen = getDemoSwipedIds();
  seen.add(targetId);
  localStorage.setItem(DEMO_SWIPES_KEY, JSON.stringify(Array.from(seen)));
}

export function resetDemoSwipes(): void {
  localStorage.removeItem(DEMO_SWIPES_KEY);
}

function computeDemoMatch(currentUser: UserProfile | null, personaUser: UserProfile): { score: number; reasons: string[] } {
  const currentLifestyle = currentUser?.profile.lifestyle;
  const personaLifestyle = personaUser.profile.lifestyle;
  let points = 80;
  const reasons: string[] = [];

  const currentCity = currentUser?.profile.search?.location.city || 'Ahmedabad';
  const personaCity = personaUser.profile.search?.location.city || 'Ahmedabad';
  if (currentCity.toLowerCase() === personaCity.toLowerCase()) {
    points += 6;
    reasons.push(`Shared search area in ${personaCity}.`);
  }

  if (currentLifestyle && personaLifestyle) {
    if (currentLifestyle.diet && currentLifestyle.diet === personaLifestyle.diet) {
      points += 4;
      reasons.push(`Compatible diet preferences (${personaLifestyle.diet}).`);
    }
    if (currentLifestyle.sleep_schedule && currentLifestyle.sleep_schedule === personaLifestyle.sleep_schedule) {
      points += 3;
      reasons.push(`Aligned sleep routines (${personaLifestyle.sleep_schedule.replace('_', ' ')}).`);
    }
    if (currentLifestyle.cleanliness != null && personaLifestyle.cleanliness != null && Math.abs(currentLifestyle.cleanliness - personaLifestyle.cleanliness) <= 1) {
      points += 4;
      reasons.push(`Similar standard of cleanliness.`);
    }
    if (currentLifestyle.smokes === personaLifestyle.smokes) {
      points += 3;
    }
  }

  const score = Math.min(98, Math.max(75, points));
  if (reasons.length === 0) {
    reasons.push(`Harmonious move-in timeline and balanced household expectations.`);
  }
  return { score, reasons };
}

function getOfflineDemoFeed(params: FeedQueryParams = {}): FeedResponse {
  const currentUser = getStoredUser();
  const currentId = currentUser?.id || 'demo-user-1';
  const seen = getDemoSwipedIds();
  const includeSeen = Boolean(params.include_seen);
  const minScore = params.min_match_score ?? 0;
  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;

  const candidates: Candidate[] = DEMO_PERSONAS
    .filter(p => p.user.id !== currentId)
    .filter(p => includeSeen || !seen.has(p.user.id))
    .map(p => {
      const { score, reasons } = computeDemoMatch(currentUser, p.user);
      const isProperty = Boolean(p.user.offering);
      const city = p.user.profile.search?.location.city || (p.user.offering?.location.city) || 'Ahmedabad';
      const areas = p.user.profile.search?.location.areas || (p.user.offering?.location.area ? [p.user.offering.location.area] : ['Navrangpura']);
      const pincodes = p.user.profile.search?.location.pincodes || (p.user.offering?.location.pincode ? [p.user.offering.location.pincode] : ['380009']);
      const label = `${areas[0] || 'Navrangpura'}, ${city}`;

      const badges: string[] = [
        p.user.profile.lifestyle?.diet === 'vegetarian' ? 'Vegetarian' : p.user.profile.lifestyle?.diet ? `Diet: ${p.user.profile.lifestyle.diet}` : '',
        p.user.profile.lifestyle?.sleep_schedule === 'early_bird' ? 'Early riser' : 'Night owl',
        p.user.profile.lifestyle?.smokes ? 'Smoker friendly' : 'Non-smoker',
        `Cleanliness: ${p.user.profile.lifestyle?.cleanliness || 4}/5`,
      ].filter(Boolean);

      return {
        id: p.user.id,
        full_name: p.user.profile.full_name,
        age: p.user.profile.age,
        gender: p.user.profile.gender,
        occupation: p.user.profile.occupation || 'Creative Professional',
        bio: p.user.profile.bio,
        intent: p.user.profile.intent,
        intents: [p.user.profile.intent],
        lifestyle: p.user.profile.lifestyle,
        offering: p.user.offering as any,
        compatibility: {
          score,
          cosine_similarity: score / 100,
          method: isProperty ? 'housing_fit' : 'weighted_cosine',
          reasons,
        },
        match_score: score,
        card_type: isProperty ? 'property' : 'person',
        title: isProperty && p.user.offering ? p.user.offering.title : p.user.profile.full_name,
        location: {
          city,
          areas,
          pincodes,
          label,
          kind: isProperty ? 'property' : 'search_preference',
        },
        media: isProperty && p.user.offering?.media ? p.user.offering.media : p.user.media,
        profile_media: p.user.media,
        budget: p.user.profile.search?.budget || null,
        badges,
      } as Candidate;
    })
    .filter(c => c.match_score >= minScore);

  candidates.sort((a, b) => b.match_score - a.match_score);
  const sliced = candidates.slice(offset, offset + limit);
  const has_more = offset + limit < candidates.length;

  return {
    items: sliced,
    total: candidates.length,
    passed_count: seen.size,
    limit,
    offset,
    has_more,
    next_offset: has_more ? offset + limit : null,
  };
}

function handleOfflineSwipe(payload: SwipeRequest): SwipeResponse {
  recordDemoSwipe(payload.target_id);
  const matched = payload.direction === 'like' || payload.direction === 'superlike';
  return {
    matched,
    match_id: matched ? `demo-match-${payload.target_id}` : null,
    message: matched ? "It's a mutual match!" : undefined,
  };
}

export function fetchFeed(): Promise<FeedResponse>;
export function fetchFeed(params: FeedQueryParams): Promise<FeedResponse>;
export async function fetchFeed(params: FeedQueryParams = {}): Promise<FeedResponse> {
  const token = getStoredToken();
  if (token?.startsWith('offline_demo_')) {
    return getOfflineDemoFeed(params);
  }
  const query = new URLSearchParams();
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  else query.set('limit', '100');
  if (params.offset !== undefined) query.set('offset', String(params.offset));
  if (params.include_seen !== undefined) query.set('include_seen', String(params.include_seen));
  if (params.min_match_score !== undefined) query.set('min_match_score', String(params.min_match_score));

  const queryString = query.toString() ? `?${query.toString()}` : '';
  try {
    return await request<FeedResponse>(`/users/feed${queryString}`, { headers: authorization() });
  } catch (error) {
    if (token?.startsWith('offline_demo_') || (error instanceof ApiError && error.status === 0)) {
      return getOfflineDemoFeed(params);
    }
    throw error;
  }
}

export function swipeCandidate(target_id: string, direction: 'like' | 'pass'): Promise<SwipeResponse>;
export function swipeCandidate(payload: SwipeRequest): Promise<SwipeResponse>;
export async function swipeCandidate(
  target_id_or_payload: string | SwipeRequest,
  direction?: 'like' | 'pass'
): Promise<SwipeResponse> {
  const payload: SwipeRequest = typeof target_id_or_payload === 'string'
    ? { target_id: target_id_or_payload, direction: direction || 'like' }
    : target_id_or_payload;

  const token = getStoredToken();
  if (token?.startsWith('offline_demo_')) {
    return handleOfflineSwipe(payload);
  }
  try {
    return await request<SwipeResponse>('/swipe', {
      ...jsonPost(payload),
      headers: { ...authorization(), 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (token?.startsWith('offline_demo_') || (error instanceof ApiError && error.status === 0)) {
      return handleOfflineSwipe(payload);
    }
    throw error;
  }
}

export function getOfflineDemoListings(params: { limit?: number; offset?: number; min_match_score?: number } = {}): ListingFeed {
  const minScore = params.min_match_score ?? 0;
  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;

  const filtered = MOCK_LISTINGS.filter(item => item.match_score >= minScore);
  const sliced = filtered.slice(offset, offset + limit);
  const has_more = offset + limit < filtered.length;

  return {
    items: sliced,
    total: filtered.length,
    limit,
    offset,
    has_more,
    next_offset: has_more ? offset + limit : null,
  };
}

export async function fetchListings(params: { limit?: number; offset?: number; min_match_score?: number } = {}): Promise<ListingFeed> {
  const token = getStoredToken();
  if (token?.startsWith('offline_demo_')) {
    return getOfflineDemoListings(params);
  }
  const query = new URLSearchParams();
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  if (params.offset !== undefined) query.set('offset', String(params.offset));
  if (params.min_match_score !== undefined) query.set('min_match_score', String(params.min_match_score));

  const queryString = query.toString() ? `?${query.toString()}` : '';
  try {
    const res = await request<ListingFeed>(`/listings${queryString}`, { headers: authorization() });
    if (!res || !res.items || res.items.length === 0) {
      return getOfflineDemoListings(params);
    }
    return res;
  } catch (error) {
    if (token?.startsWith('offline_demo_') || (error instanceof ApiError && (error.status === 0 || error.status === 401 || error.status === 404))) {
      return getOfflineDemoListings(params);
    }
    throw error;
  }
}
