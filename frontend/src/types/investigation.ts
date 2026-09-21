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
  customer_id?: string | null;
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
  risk_signal?: string | number | null;
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
  requested_at?: string | null;
  responded_at?: string | null;
}

export interface KeyEvidenceFinding {
  evidence_id: string;
  finding: string;
  significance: 'LOW' | 'MEDIUM' | 'HIGH' | 'NEUTRAL' | string;
}

export interface ReasoningResult {
  summary?: string;
  key_evidence?: KeyEvidenceFinding[];
  observed_patterns?: string[];
  conflicting_evidence?: string[];
  missing_evidence?: string[];
  uncertainties?: string[];
  relevant_rules?: string[];
  reasoning?: string;
}

export interface InvestigationResult {
  case_id: string;
  customer_id?: string | null;
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
  SAR?: {
    status?: string;
    reason?: string;
    [key: string]: any;
  } | null;
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

export interface InvestigationHistoryItem {
  investigation_id: string;
  case_id: string;
  customer_id?: string | null;
  case_status?: string | null;
  status?: string | null;
  verdict?: Verdict;
  created_at: string;
  completed_at?: string | null;
  reasoning_summary?: string | null;
  stop_reason?: string | null;
}

export interface InvestigationHistoryResponse {
  case_id: string;
  investigations: InvestigationHistoryItem[];
}

export interface AuditEventItem {
  id: number;
  case_id: string;
  investigation_id?: string | null;
  event_type: string;
  description?: string | null;
  actor: 'SYSTEM' | 'AGENT' | 'ANALYST' | string;
  metadata_json?: string | null;
  created_at: string;
}

export interface RuleEvaluationItem {
  rule_id: string;
  rule_name?: string;
  triggered: boolean;
  reason?: string;
  description?: string;
  severity?: string;
  created_at?: string;
}

export interface InvestigationDetailResponse {
  investigation_id: string;
  case_id: string;
  customer_id?: string | null;
  case_status?: CaseStatus;
  status?: CaseStatus;
  verdict?: Verdict;
  fraud_probability?: number | null;
  pattern?: string | null;
  reasoning_summary?: string | null;
  stop_reason?: string | null;
  exposure?: number | null;
  sar_status?: string | null;
  sar_reason?: string | null;
  llm_provider?: string | null;
  llm_model?: string | null;
  llm_latency?: number | null;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  total_tokens?: number | null;
  created_at: string;
  completed_at?: string | null;
  evidence: EvidenceItem[];
  actions_initial: string[];
  actions_final: string[];
  rules: RuleEvaluationItem[];
  audit_events: AuditEventItem[];
}

