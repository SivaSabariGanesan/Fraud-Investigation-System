export type Verdict = 'APPROVED' | 'DECLINED' | 'NEEDS_REVIEW' | null;
export type CaseStatus = 'PENDING' | 'INVESTIGATING' | 'COMPLETED' | 'CLOSED';

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
  id: string;
  type: string;
  details: Record<string, unknown>;
  risk_signal: string | null;
}

export interface InvestigationResult {
  case_id: string;
  status: CaseStatus;
  verdict: Verdict;
  fraud_probability: number | null;
  pattern: string | null;
  exposure: number | null;
  evidence_count: number;
  reasoning_summary: string | null;
  evidence: EvidenceItem[];
  created_at: string;
  updated_at: string;
}

export interface HealthCheckResponse {
  status: string;
}
