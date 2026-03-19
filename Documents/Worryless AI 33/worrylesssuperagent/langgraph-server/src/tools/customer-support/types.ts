// Customer Support tool type contracts (OPS-01)

export interface CSClassification {
  isCreateTicket: boolean;
  isListTickets: boolean;
  isUpdateTicket: boolean;
  isSearchKB: boolean;
  isHealthScore: boolean;
  isChurnDetection: boolean;
}

export interface SupportTicketRow {
  id: string;
  user_id: string;
  customer_name: string;
  customer_email: string | null;
  subject: string;
  description: string | null;
  status: "open" | "in_progress" | "waiting" | "resolved" | "closed";
  priority: "urgent" | "high" | "normal" | "low";
  category: string | null;
  resolution: string | null;
  health_score: number | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface CreateTicketInput {
  userId: string;
  customerName: string;
  customerEmail?: string;
  subject: string;
  description?: string;
  priority?: "urgent" | "high" | "normal" | "low";
  category?: string;
}

export interface HealthScore {
  customerName: string;
  score: number;
  factors: { ticketFrequency: number; avgResolutionTime: number; sentiment: string };
}

export interface ChurnRisk {
  customerName: string;
  riskLevel: "high" | "medium" | "low";
  reason: string;
  ticketCount: number;
  lastTicketDate: string;
}
