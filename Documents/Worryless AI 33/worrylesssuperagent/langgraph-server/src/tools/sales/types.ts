// Sales Rep tool type contracts — used by all tool files in this directory.

export interface GenerateLeadsInput {
  userId: string;
  query: string;
  location?: string;
  industry?: string;
  jobTitle?: string;
  fetchCount?: number;
}

export interface LeadRow {
  id: string;
  user_id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  website: string | null;
  industry: string | null;
  company_size: string | null;
  location: string | null;
  status: string;
  score: number;
  notes: string | null;
  source: string | null;
  deal_value: number | null;
  follow_up_scheduled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApifyLead {
  company_name?: string;
  contact_full_name?: string;
  contact_email?: string;
  contact_phone?: string;
  company_website?: string;
  company_industry?: string;
  company_employee_count?: string;
  contact_location?: string;
  contact_linkedin_url?: string;
}

export interface ProspectResearch {
  companyName: string;
  description: string;
  products: string[];
  recentNews: string[];
  teamSize: string;
  fundingStage: string;
  painPoints: string[];
  talkingPoints: string[];
}

export interface OutreachEmail {
  subject: string;
  body: string;
  leadId: string;
  contactName: string;
  companyName: string;
}

export interface OutreachEmailRow {
  id: string;
  user_id: string;
  lead_id: string;
  subject: string;
  body: string;
  sent_at: string | null;
  opened_at: string | null;
  replied_at: string | null;
  resend_email_id: string | null;
  click_count: number;
  open_count: number;
  created_at: string;
}

export interface EmailEngagement {
  emailId: string;
  subject: string;
  sentAt: string;
  opens: number;
  clicks: number;
  replied: boolean;
  leadName: string;
  companyName: string;
}

export interface DealStatusUpdate {
  userId: string;
  leadId: string;
  newStatus: string;
  notes?: string;
}

export interface FollowUp {
  userId: string;
  leadId: string;
  scheduledAt: string;
  reason?: string;
}

export interface StaleDeal {
  id: string;
  company_name: string;
  contact_name: string;
  status: string;
  score: number;
  deal_value: number | null;
  updated_at: string;
  daysSinceUpdate: number;
}

export interface PipelineStageRow {
  status: string;
  deal_count: number;
  total_score: number;
  total_deal_value: number | null;
  avg_days_in_stage: number;
}

export interface PipelineAnalysis {
  byStage: PipelineStageRow[];
  conversionRate: number;
  totalDeals: number;
  totalValue: number;
}

export interface RevenueForcast {
  projected30d: number;
  projected60d: number;
  projected90d: number;
  weightedPipeline: number;
  historicalConversionRate: number;
}

export interface ProposalInput {
  userId: string;
  leadId: string;
  companyName: string;
  contactName: string;
  solutionSummary: string;
  pricing?: string;
}

// Classifier output for Sales Rep request routing
export interface SalesClassification {
  isLeadGeneration: boolean;
  isLeadEnrich: boolean;
  isProspectResearch: boolean;
  isComposeOutreach: boolean;
  isSendOutreach: boolean;
  isEmailEngagement: boolean;
  isDealStatusUpdate: boolean;
  isScheduleFollowUp: boolean;
  isCreateProposal: boolean;
  isPipelineAnalysis: boolean;
  isRevenueForcast: boolean;
  isStaleDeals: boolean;
}
