import axios from 'axios';
import {
  Case,
  InvestigationResult,
  HealthCheckResponse,
  InvestigationHistoryResponse,
  InvestigationDetailResponse,
  AuditEventItem,
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
};

