import type { AuthResponse, LoginRequest, SignupRequest, UserProfile, MediaResponse } from '../types/auth';
import type { DiscoveryFeedResponse, SwipeDirection, SwipeResponse } from '../types/discovery';
import type { ConnectionRequestsResponse, MatchView } from '../types/connections';
import { DEMO_PERSONAS } from './demoPersonas';

const API_BASE_URL = (import.meta.env.VITE_API_URL || "https://childrens-after-janet-brass.trycloudflare.com/api" || '/api').replace(/\/$/, '');
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

export function mediaUrl(url: string): string {
  return new URL(url, new URL(API_BASE_URL, window.location.origin)).href;
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
    const user: UserProfile = { ...current, deletion_request: requested ? current.deletion_request || {
      requested_at: now.toISOString(), scheduled_for: new Date(now.getTime() + 7 * 86400000).toISOString(),
    } : null };
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

export async function getDiscoveryFeed(limit = 20, offset = 0): Promise<DiscoveryFeedResponse | null> {
  const token = getStoredToken();
  if (!token || token.startsWith('offline_demo_')) return null;
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    include_seen: 'false',
    min_match_score: '0',
  });
  return request(`/list?${params.toString()}`, { headers: authorization() });
}

export async function postSwipe(targetId: string, direction: SwipeDirection, note?: string): Promise<SwipeResponse | null> {
  const token = getStoredToken();
  if (!token || token.startsWith('offline_demo_')) return null;
  try {
    const body: { target_id: string; direction: SwipeDirection; note?: string } = { target_id: targetId, direction };
    if (note) body.note = note;
    return await request<SwipeResponse>('/swipe', {
      method: 'POST',
      headers: { ...authorization(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return null;
  }
}

export async function getConnectionRequests(limit = 20, offset = 0): Promise<ConnectionRequestsResponse | null> {
  const token = getStoredToken();
  if (!token || token.startsWith('offline_demo_')) return null;
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  return request(`/connections/requests?${params.toString()}`, { headers: authorization() });
}

export async function getMatches(limit = 20, offset = 0): Promise<MatchView[] | null> {
  const token = getStoredToken();
  if (!token || token.startsWith('offline_demo_')) return null;
  return request(`/matches?limit=${limit}&offset=${offset}`, { headers: authorization() });
}
