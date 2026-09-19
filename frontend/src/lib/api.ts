import type { AuthResponse, LoginRequest, SignupRequest, UserProfile, MediaResponse } from '../types/auth';
import type { FeedResponse } from '../types/feed';
import type { ChatMessage, ConnectionRequestsResponse, MatchView } from '../types/connections';
import type { ListingFeed, OfferingView } from '../types/feed';
import { DEMO_PERSONAS } from './demoPersonas';
import type { CreatePropertyReview, PropertyReview, PropertyReviewFeed, ReviewedProperty, ReviewSort } from '../types/reviews';

const rawApiUrl = (import.meta.env.VITE_API_URL?.trim() || '/api').replace(/\/+$/, '');
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

export async function updateProfile(payload: {
  profile?: UserProfile['profile'];
  offering?: Partial<UserProfile['offering']> | null;
}): Promise<UserProfile> {
  return request('/users/me', {
    method: 'PUT',
    headers: { ...authorization(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function setAccountDeletionRequested(requested: boolean): Promise<UserProfile> {
  const path = '/users/me/deletion-request';
  if (requested) {
    return request(path, { method: 'POST', headers: authorization() });
  }
  return request(path, { method: 'DELETE', headers: authorization() });
}

export async function getDiscoveryFeed(limit = 20, offset = 0): Promise<FeedResponse | null> {
  const token = getStoredToken();
  if (!token) return null;
  try {
    return await request<FeedResponse>(`/users/feed?limit=${limit}&offset=${offset}`, { headers: authorization() });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    return null;
  }
}

export async function postSwipe(targetId: string, direction: 'like' | 'pass' | 'superlike', note?: string): Promise<{ matched: boolean; match_id: string | null; message: string }> {
  return request('/swipe', {
    method: 'POST',
    headers: { ...authorization(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_id: targetId, direction, ...(note ? { note } : {}) }),
  });
}

export function requestPropertyTour(listing: Pick<OfferingView, 'owner_id' | 'title'>) {
  return postSwipe(listing.owner_id, 'like', `Hi! I'd like to arrange a tour of "${listing.title}". When would be a good time?`);
}

export async function fetchFeed(limit = 20, offset = 0, includeSeen = false, minMatchScore = 0): Promise<FeedResponse> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset), include_seen: String(includeSeen), min_match_score: String(minMatchScore) });
  return request<FeedResponse>(`/users/feed?${params.toString()}`, { headers: authorization() });
}

export async function swipeCandidate(targetId: string, direction: 'like' | 'pass' | 'superlike'): Promise<{ matched: boolean; match_id: string | null; message: string }> {
  return postSwipe(targetId, direction);
}

export async function getConnectionRequests(limit = 20, offset = 0): Promise<ConnectionRequestsResponse> {
  return request<ConnectionRequestsResponse>(`/connections/requests?limit=${limit}&offset=${offset}`, { headers: authorization() });
}

export async function getMatches(limit = 20, offset = 0): Promise<MatchView[]> {
  return request<MatchView[]>(`/matches?limit=${limit}&offset=${offset}`, { headers: authorization() });
}

export function getMessages(matchId: string, limit = 100, offset = 0): Promise<ChatMessage[]> {
  return request(`/matches/${encodeURIComponent(matchId)}/messages?limit=${limit}&offset=${offset}`, { headers: authorization() });
}

export function sendMessage(matchId: string, content: string): Promise<ChatMessage> {
  return request(`/matches/${encodeURIComponent(matchId)}/messages`, {
    method: 'POST', headers: { ...authorization(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: content.trim() }),
  });
}

export async function fetchListings(params: { limit?: number; offset?: number; min_match_score?: number } = {}): Promise<ListingFeed> {
  const search = new URLSearchParams();
  if (params.limit) search.set('limit', String(params.limit));
  if (params.offset) search.set('offset', String(params.offset));
  if (params.min_match_score !== undefined) search.set('min_match_score', String(params.min_match_score));
  const query = search.toString();
  return request<ListingFeed>(`/listings${query ? `?${query}` : ''}`, { headers: authorization() });
}

export function getReviewedProperties(): Promise<ReviewedProperty[]> {
  return request('/reviews/properties', { headers: authorization() });
}

export function getPropertyReviews(listingId: string, sort: ReviewSort = 'recent', offset = 0): Promise<PropertyReviewFeed> {
  return request(`/listings/${encodeURIComponent(listingId)}/reviews?limit=10&offset=${offset}&sort=${sort}`, { headers: authorization() });
}

export function createPropertyReview(listingId: string, review: CreatePropertyReview): Promise<PropertyReview> {
  const body = new FormData();
  body.append('rating', String(review.rating));
  body.append('experience', review.experience);
  body.append('content', review.content.trim());
  review.photos.forEach(photo => body.append('files', photo));
  return request(`/listings/${encodeURIComponent(listingId)}/reviews`, { method: 'POST', headers: authorization(), body }, 120000);
}

export function deletePropertyReview(reviewId: string): Promise<{ message: string }> {
  return request(`/reviews/${encodeURIComponent(reviewId)}`, { method: 'DELETE', headers: authorization() });
}

export function setReviewHelpful(reviewId: string, helpful: boolean): Promise<PropertyReview> {
  return request(`/reviews/${encodeURIComponent(reviewId)}/helpful`, {
    method: 'PUT', headers: { ...authorization(), 'Content-Type': 'application/json' }, body: JSON.stringify({ helpful }),
  });
}
