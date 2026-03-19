// Legal & Compliance tool type contracts (OPS-02)

export interface LegalClassification {
  isReviewContract: boolean;
  isListContracts: boolean;
  isDraftTemplate: boolean;
  isContractCalendar: boolean;
  isMonitorRegulatory: boolean;
}

export interface ContractRow {
  id: string;
  user_id: string;
  title: string;
  counterparty: string;
  contract_type: string;
  status: "draft" | "review" | "active" | "expired" | "terminated";
  start_date: string | null;
  end_date: string | null;
  renewal_date: string | null;
  value: number | null;
  key_terms: Record<string, unknown>;
  risk_flags: Array<{ severity: string; description: string }>;
  created_at: string;
  updated_at: string;
}

export interface ContractReview {
  contractId: string;
  riskFlags: Array<{ severity: "high" | "medium" | "low"; description: string; clause: string }>;
  keyTerms: Record<string, string>;
  recommendation: string;
}

export interface RenewalAlert {
  contractId: string;
  title: string;
  counterparty: string;
  renewalDate: string;
  daysUntilRenewal: number;
  value: number | null;
}
