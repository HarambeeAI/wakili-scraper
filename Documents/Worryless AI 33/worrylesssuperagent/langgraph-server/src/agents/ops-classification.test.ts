import { describe, it, expect } from "vitest";
import { classifyCSRequest } from "./customer-support.js";
import { classifyLegalRequest } from "./legal-compliance.js";
import { classifyHRRequest } from "./hr.js";
import { classifyPRRequest } from "./pr-comms.js";
import { classifyProcurementRequest } from "./procurement.js";
import { classifyDARequest } from "./data-analyst.js";
import { classifyOpsRequest } from "./operations.js";

describe("Customer Support classification", () => {
  it("detects create ticket", () => expect(classifyCSRequest("Open a new support ticket").isCreateTicket).toBe(true));
  it("detects KB search", () => expect(classifyCSRequest("Search the knowledge base for return policy").isSearchKB).toBe(true));
  it("detects churn", () => expect(classifyCSRequest("Which customers are at risk of churning?").isChurnDetection).toBe(true));
  it("returns false for unrelated", () => expect(Object.values(classifyCSRequest("Hello")).every(v => v === false)).toBe(true));
});

describe("Legal classification", () => {
  it("detects contract review", () => expect(classifyLegalRequest("Review this contract for risks").isReviewContract).toBe(true));
  it("detects renewals", () => expect(classifyLegalRequest("What contracts are expiring soon?").isContractCalendar).toBe(true));
  it("detects template draft", () => expect(classifyLegalRequest("Draft an NDA template").isDraftTemplate).toBe(true));
});

describe("HR classification", () => {
  it("detects job posting", () => expect(classifyHRRequest("Create a job posting for engineer").isCreateJobPosting).toBe(true));
  it("detects resume screening", () => expect(classifyHRRequest("Screen this resume for the PM role").isScreenResume).toBe(true));
  it("detects onboarding", () => expect(classifyHRRequest("Create a 30-60-90 onboarding plan").isOnboardingPlan).toBe(true));
});

describe("PR classification", () => {
  it("detects press release", () => expect(classifyPRRequest("Draft a press release for our launch").isDraftPressRelease).toBe(true));
  it("detects media monitoring", () => expect(classifyPRRequest("Monitor media mentions of our brand").isMonitorMedia).toBe(true));
  it("detects sentiment", () => expect(classifyPRRequest("How is our brand perception?").isAnalyzeSentiment).toBe(true));
});

describe("Procurement classification", () => {
  it("detects supplier search", () => expect(classifyProcurementRequest("Find suppliers for office furniture").isSearchSuppliers).toBe(true));
  it("detects PO creation", () => expect(classifyProcurementRequest("Create a purchase order for 50 laptops").isCreatePO).toBe(true));
  it("detects vendor scoring", () => expect(classifyProcurementRequest("Score our top vendor").isScoreVendor).toBe(true));
});

describe("Data Analyst classification", () => {
  it("detects query intent", () => expect(classifyDARequest("Show me revenue by month").isCrossFunctionalQuery).toBe(true));
  it("detects anomaly", () => expect(classifyDARequest("Are there any anomalies in our data?").isAnomalyDetection).toBe(true));
  it("detects chart", () => expect(classifyDARequest("Generate a bar chart of expenses").isGenerateChart).toBe(true));
  it("detects KPI", () => expect(classifyDARequest("Show me the KPI dashboard").isKPIAggregation).toBe(true));
});

describe("Operations classification", () => {
  it("detects project creation", () => expect(classifyOpsRequest("Create a new project for Q3 launch").isCreateProject).toBe(true));
  it("detects bottleneck analysis", () => expect(classifyOpsRequest("Which milestones are blocked?").isAnalyzeBottlenecks).toBe(true));
  it("detects SOP drafting", () => expect(classifyOpsRequest("Draft a standard operating procedure for onboarding").isDraftSOP).toBe(true));
  it("detects list projects", () => expect(classifyOpsRequest("Show all active projects").isListProjects).toBe(true));
});
