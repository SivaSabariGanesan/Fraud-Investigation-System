import axios from 'axios';
import {
  Case,
  InvestigationResult,
  HealthCheckResponse,
  InvestigationHistoryResponse,
  InvestigationDetailResponse,
  AuditEventItem,
  EvidenceRequest,
  EvidenceRequestCreatePayload,
  EvidenceRequestRespondPayload,
  EvidenceRequestCancelPayload,
  EvidenceRequestRespondResult,
  CaseGraphResponse,
  SarRecord,
  SarReviewPayload,
  SarPreparePayload,
  SarSubmissionStatusPayload,
} from '../types/investigation';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const apiService = {
  async checkHealth(): Promise<HealthCheckResponse> {
    const response = await apiClient.get<HealthCheckResponse>('/health');
    return response.data;
  },

  async getCases(): Promise<Case[]> {
    const response = await apiClient.get<Case[]>('/api/cases');
    return response.data;
  },

  async getCase(caseId: string): Promise<Case> {
    const response = await apiClient.get<Case>(`/api/cases/${caseId}`);
    return response.data;
  },

  async getCaseById(caseId: string): Promise<Case> {
    return this.getCase(caseId);
  },

  async investigateCase(caseId: string, notes?: string): Promise<InvestigationResult> {
    const response = await apiClient.post<InvestigationResult>(`/api/investigations/${caseId}`, {
      notes: notes || null,
      force_reinvestigate: true,
    });
    return response.data;
  },

  async runInvestigation(caseId: string, notes?: string): Promise<InvestigationResult> {
    return this.investigateCase(caseId, notes);
  },

  async getCaseInvestigations(caseId: string): Promise<InvestigationHistoryResponse> {
    const response = await apiClient.get<InvestigationHistoryResponse>(`/api/cases/${caseId}/investigations`);
    return response.data;
  },

  async getInvestigation(investigationId: string): Promise<InvestigationDetailResponse> {
    const response = await apiClient.get<InvestigationDetailResponse>(`/api/investigations/${investigationId}`);
    return response.data;
  },

  async getCaseAuditTimeline(caseId: string): Promise<AuditEventItem[]> {
    const response = await apiClient.get<AuditEventItem[]>(`/api/cases/${caseId}/audit`);
    return response.data;
  },

  // ---- Evidence Request lifecycle methods ----

  /** List all evidence requests for a case (newest first). */
  async getEvidenceRequests(caseId: string): Promise<EvidenceRequest[]> {
    const response = await apiClient.get<EvidenceRequest[]>(`/api/evidence-requests/${caseId}`);
    return response.data;
  },

  /** Get a single evidence request by case + request ID. */
  async getEvidenceRequest(caseId: string, requestId: string): Promise<EvidenceRequest> {
    const response = await apiClient.get<EvidenceRequest>(`/api/evidence-requests/${caseId}/${requestId}`);
    return response.data;
  },

  /** Create a new PENDING evidence request for a case. */
  async createEvidenceRequest(caseId: string, payload: EvidenceRequestCreatePayload): Promise<EvidenceRequest> {
    const response = await apiClient.post<EvidenceRequest>(`/api/evidence-requests/${caseId}`, payload);
    return response.data;
  },

  /**
   * Record a real analyst/customer response to a PENDING evidence request.
   * This triggers a NEW investigation automatically.
   * CRITICAL: The response must be genuinely provided — never auto-generated.
   */
  async respondToEvidenceRequest(
    requestId: string,
    payload: EvidenceRequestRespondPayload,
  ): Promise<EvidenceRequestRespondResult> {
    const response = await apiClient.post<EvidenceRequestRespondResult>(
      `/api/evidence-requests/${requestId}/respond`,
      payload,
    );
    return response.data;
  },

  /** Cancel a PENDING evidence request. Does not trigger a new investigation. */
  async cancelEvidenceRequest(
    requestId: string,
    payload: EvidenceRequestCancelPayload,
  ): Promise<EvidenceRequest> {
    const response = await apiClient.post<EvidenceRequest>(
      `/api/evidence-requests/${requestId}/cancel`,
      payload,
    );
    return response.data;
  },

  /** Get case-specific real TigerGraph network visualization nodes and edges. */
  async getCaseGraph(caseId: string): Promise<CaseGraphResponse> {
    const response = await apiClient.get<CaseGraphResponse>(`/api/cases/${caseId}/graph`);
    return response.data;
  },

  // ---- SAR Workflow API methods ----

  /** Get current SAR record for a case. */
  async getCaseSar(caseId: string): Promise<SarRecord> {
    const response = await apiClient.get<SarRecord>(`/api/cases/${caseId}/sar`);
    return response.data;
  },

  /** Analyst review of a CANDIDATE or UNDER_REVIEW SAR record (approve / do_not_file). */
  async reviewCaseSar(caseId: string, payload: SarReviewPayload): Promise<SarRecord> {
    const response = await apiClient.post<SarRecord>(`/api/cases/${caseId}/sar/review`, payload);
    return response.data;
  },

  /** Generate structured internal SAR report draft for an APPROVED SAR record. */
  async prepareCaseSar(caseId: string, payload?: SarPreparePayload): Promise<SarRecord> {
    const response = await apiClient.post<SarRecord>(`/api/cases/${caseId}/sar/prepare`, payload || {});
    return response.data;
  },

  /** Update internal submission tracking status for a PREPARED SAR record. */
  async updateCaseSarSubmission(caseId: string, payload?: SarSubmissionStatusPayload): Promise<SarRecord> {
    const response = await apiClient.post<SarRecord>(`/api/cases/${caseId}/sar/submission-status`, payload || {});
    return response.data;
  },
};




