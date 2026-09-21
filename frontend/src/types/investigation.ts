export type Verdict = 'APPROVED' | 'DECLINED' | 'NEEDS_REVIEW' | null;

export type CaseStatus =
  | 'PENDING'
  | 'INVESTIGATING'
  | 'COMPLETED'
  | 'CLOSED'
  | 'UNDER_INVESTIGATION'
  | 'VERIFICATION_PENDING'
  | 'UNRESOLVED'
  | 'CONFIRMED_FRAUD'
  | 'CLEARED'
  | 'NEEDS_REVIEW';

export interface Case {
  case_id: string;
  status: CaseStatus;
  verdict: Verdict;
  fraud_probability: number | null;
  pattern: string | null;
  exposure: number | null;
  created_at: string;
  updated_at: string;
  notes?: string | null;
}

export interface EvidenceItem {
  id?: string;
  evidence_id?: string;
  type?: string;
  evidence_type?: string;
  source?: string;
  description?: string;
  related_entity?: string | null;
  transaction_id?: string | null;
  card_id?: string | null;
  strength?: string | null;
  raw_data?: Record<string, any>;
  details?: Record<string, any>;
  risk_signal?: string | null;
  timestamp?: string | null;
}

export interface EvidenceRequest {
  request_id: string;
  case_id?: string;
  request_type?: string;
  status: string;
  details?: Record<string, any>;
  created_at?: string;
  response?: string | null;
  request_text?: string | null;
}

export interface InvestigationResult {
  case_id: string;
  case_status: CaseStatus;
  status: CaseStatus;
  verdict: Verdict;
  fraud_probability: number | null;
  pattern: string | null;
  evidence: EvidenceItem[];
  affected_transaction_ids: string[];
  connected_card_ids: string[];
  connected_device_ids: string[];
  exposure: number;
  similar_prior_cases: string[];
  written_to_graph: boolean;
  evidence_requests: EvidenceRequest[];
  next_best_actions_initial: string[];
  next_best_actions_final: string[];
  SAR?: Record<string, any> | null;
  stop_reason?: string | null;
  tool_calls?: Record<string, any>[];
  tokens?: { prompt: number; completion: number; total: number };
  latency?: number;
  evidence_count?: number;
  reasoning_summary?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface HealthCheckResponse {
  status: string;
}
