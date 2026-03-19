// HR tool type contracts (OPS-03)

export interface HRClassification {
  isCreateJobPosting: boolean;
  isScreenResume: boolean;
  isTrackCandidate: boolean;
  isListCandidates: boolean;
  isOnboardingPlan: boolean;
  isPerformanceReview: boolean;
}

export interface CandidateRow {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  position: string;
  status: "prospecting" | "applied" | "screened" | "interview" | "offer" | "hired" | "rejected";
  resume_text: string | null;
  skills_score: number | null;
  experience_score: number | null;
  culture_score: number | null;
  overall_score: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResumeScreening {
  candidateId: string;
  name: string;
  skillsScore: number;
  experienceScore: number;
  cultureScore: number;
  overallScore: number;
  strengths: string[];
  gaps: string[];
  recommendation: string;
}

export interface JobPosting {
  title: string;
  description: string;
  requirements: string[];
  benefits: string[];
  location: string;
  employmentType: string;
}

export interface OnboardingPlan {
  candidateName: string;
  position: string;
  milestones: Array<{ day: number; task: string; owner: string }>;
}
