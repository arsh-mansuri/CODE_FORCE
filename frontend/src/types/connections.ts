import type { ApiCandidate } from './discovery';

export interface ConnectionRequestView {
  id: string;
  requester: ApiCandidate;
  direction: 'like' | 'superlike';
  note: string | null;
  created_at: string;
}

export interface ConnectionRequestsResponse {
  items: ConnectionRequestView[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
  next_offset: number | null;
}

export interface MatchView {
  id: string;
  other_user: ApiCandidate;
  compatibility_score: number;
  created_at: string;
}