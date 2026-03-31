/**
 * Lawlyfy API client with SSE streaming support and auth.
 */

export const API_BASE = import.meta.env.VITE_API_URL || "/api";

const TOKEN_KEY = "lawlyfy_token";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface Citation {
  id: string;
  title: string;
  court: string;
  year: string;
  type: "case" | "statute" | "regulation" | "secondary" | "web";
  relevance: number;
  snippet: string;
  pages: string;
  source_doc_id: string;
  metadata: Record<string, unknown> & {
    local_path?: string;
    pdf_url?: string;
    url?: string;
  };
}

export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface DocumentContext {
  filename: string;
  text: string;
}

export interface ChatRequest {
  message: string;
  thread_id?: string;
  web_enabled?: boolean;
  deep_research?: boolean;
  jurisdiction_filter?: string[];
  history?: HistoryMessage[];
  documents?: DocumentContext[];
}

export interface StreamEvent {
  type:
    | "token"
    | "citations"
    | "status"
    | "done"
    | "plan"
    | "step_complete"
    | "canvas_init"
    | "canvas_intake"
    | "canvas_section"
    | "canvas_update"
    | "canvas_complete"
    | "canvas_comment"
    | "canvas_assessment";
  content?: string;
  citations?: Citation[];
  thread_id?: string;
  phase?: string;
  message?: string;
  // Deep agent plan events
  steps?: string[];
  document_requested?: boolean;
  document_format?: string;
  // Deep agent step completion events
  step?: number;
  total?: number;
  summary?: string;
  // Canvas events
  doc_type?: string;
  doc_title?: string;
  skill_slug?: string;
  section_id?: string;
  heading?: string;
  order?: number;
  sections?: Array<{
    id: string;
    heading: string;
    content: string;
    order: number;
    last_edited_by?: string;
  }>;
  version?: number;
  word_count?: number;
  answers?: Record<string, string>;
  // Canvas comments
  comment?: string;
}

export interface ExportResponse {
  download_url: string;
  format: string;
  filename: string;
}

/**
 * Stream a chat response via SSE.
 */
export async function streamChat(
  request: ChatRequest,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(request),
    signal,
  });

  if (response.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = "/login";
    return;
  }

  if (response.status === 402) {
    // Subscription/trial block — parse the error detail for the modal
    let detail: Record<string, unknown> = {};
    try {
      const body = await response.json();
      detail = body.detail || body;
    } catch {
      detail = {
        error: "subscription_inactive",
        message: "Your subscription is inactive.",
      };
    }
    const err = new Error("subscription_blocked") as Error & {
      detail: Record<string, unknown>;
    };
    err.detail = detail;
    throw err;
  }

  if (!response.ok) {
    throw new Error(`Chat request failed: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const event = JSON.parse(line.slice(6)) as StreamEvent;
          onEvent(event);
        } catch {
          // Skip malformed lines
        }
      }
    }
  }

  if (buffer.startsWith("data: ")) {
    try {
      const event = JSON.parse(buffer.slice(6)) as StreamEvent;
      onEvent(event);
    } catch {
      // Skip
    }
  }
}

/**
 * Non-streaming chat (fallback).
 */
export async function chatSync(request: ChatRequest) {
  const res = await fetch(`${API_BASE}/chat/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(`Chat request failed: ${res.status}`);
  return res.json() as Promise<{
    content: string;
    citations: Citation[];
    thread_id: string;
  }>;
}

/**
 * Get conversation history (from DB).
 */
export async function getHistory(threadId: string) {
  const res = await fetch(`${API_BASE}/threads/${threadId}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`History request failed: ${res.status}`);
  return res.json();
}

/**
 * Get canvas (drafting workspace) for a thread. Returns null if none exists.
 */
export async function getCanvas(threadId: string) {
  const res = await fetch(`${API_BASE}/canvas/${threadId}`, {
    headers: authHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Canvas request failed: ${res.status}`);
  return res.json();
}

/**
 * Export a conversation as PDF or DOCX.
 */
export async function exportConversation(
  threadId: string,
  format: "pdf" | "docx",
): Promise<ExportResponse> {
  const res = await fetch(`${API_BASE}/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ thread_id: threadId, format }),
  });
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);
  return res.json();
}

// ---------- Threads ----------

export interface ThreadSummary {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export async function listThreads(
  query = "",
  limit = 50,
  offset = 0,
): Promise<{ threads: ThreadSummary[] }> {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  params.set("limit", String(limit));
  params.set("offset", String(offset));

  const res = await fetch(`${API_BASE}/threads?${params}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Thread list failed: ${res.status}`);
  return res.json();
}

export async function deleteThread(threadId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/threads/${threadId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
}

// ---------- Team ----------

export interface TeamData {
  members: Array<{
    id: string;
    email: string;
    name: string;
    plan: string;
    is_org_admin: boolean;
  }>;
  invites: Array<{ id: string; email: string; created_at: string }>;
  max_seats: number;
  org_name?: string;
}

export async function getTeam(): Promise<TeamData> {
  const res = await fetch(`${API_BASE}/auth/team`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Team fetch failed: ${res.status}`);
  return res.json();
}

export async function inviteTeamMember(
  email: string,
): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/auth/invite`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Invite failed");
  }
  return res.json();
}

// ---------- Document Retrieval ----------

export interface PageData {
  page_number: number;
  text: string;
}

export interface DocumentPagesResponse {
  total_pages: number;
  pages: PageData[];
  local_path: string;
}

export function getDocumentPdfUrl(localPath: string): string {
  return `${API_BASE}/documents/pdf?local_path=${encodeURIComponent(localPath)}`;
}

/** Build the raw URL for an export (used with authenticated fetch). */
export function getExportDocumentUrl(exportPath: string): string {
  const path = exportPath.startsWith("/") ? exportPath : `/${exportPath}`;
  return `${API_BASE}${path}`;
}

/**
 * Fetch an authenticated blob URL for a document.
 * Works for both /exports/ and /documents/ endpoints.
 */
export async function fetchAuthenticatedBlobUrl(url: string): Promise<string> {
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Authenticated fetch failed: ${res.status}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/**
 * Return a react-pdf compatible file source with auth headers.
 */
export function getAuthenticatedPdfSource(url: string): {
  url: string;
  httpHeaders: Record<string, string>;
} {
  return { url, httpHeaders: authHeaders() };
}

export async function getDocumentPages(
  localPath: string,
): Promise<DocumentPagesResponse> {
  const res = await fetch(
    `${API_BASE}/documents/pages?local_path=${encodeURIComponent(localPath)}`,
    { headers: authHeaders() },
  );
  if (!res.ok) throw new Error(`Document pages request failed: ${res.status}`);
  return res.json();
}

export async function downloadDocumentPdf(
  localPath: string,
  filename?: string,
) {
  const url = getDocumentPdfUrl(localPath);
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename || localPath.split("/").pop() || "document.pdf";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

/** Download an exported document with auth. */
export async function downloadExportDocument(
  exportPath: string,
  filename?: string,
) {
  const url = getExportDocumentUrl(exportPath);
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Export download failed: ${res.status}`);
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename || exportPath.split("/").pop() || "document";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

// ---------- Document Upload ----------

export const TOTAL_TOKEN_BUDGET = 150_000;

export interface UploadedFile {
  filename: string;
  text: string;
  error: string;
  size?: number;
  token_estimate: number;
}

export interface UploadResponse {
  files: UploadedFile[];
  total_token_budget: number;
  tokens_used: number;
  tokens_remaining: number;
}

export async function uploadDocuments(
  files: File[],
  usedTokens: number,
  onProgress?: (percent: number) => void,
): Promise<UploadResponse> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/upload?used_tokens=${usedTokens}`);

    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        window.location.href = "/login";
        reject(new Error("Unauthorized"));
        return;
      }
      if (xhr.status >= 400) {
        reject(new Error(`Upload failed: ${xhr.status}`));
        return;
      }
      try {
        resolve(JSON.parse(xhr.responseText));
      } catch {
        reject(new Error("Invalid response"));
      }
    };

    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(formData);
  });
}

// ---------- Payments ----------

export interface InitializePaymentRequest {
  plan: string;
  seats?: number;
  callback_url?: string;
}

export interface InitializePaymentResponse {
  authorization_url: string;
  reference: string;
  access_code: string;
}

export interface PaymentStatusResponse {
  subscription_status: string;
  plan: string;
  trial_chats_used: number;
  trial_drafts_used: number;
  trial_chats_remaining: number;
  trial_drafts_remaining: number;
  trial_chats_limit: number;
  trial_drafts_limit: number;
  current_period_end: string | null;
  seats: number | null;
}

export async function initializePayment(
  req: InitializePaymentRequest,
): Promise<InitializePaymentResponse> {
  const res = await fetch(`${API_BASE}/payments/initialize`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Payment initialization failed");
  }
  return res.json();
}

export async function verifyPayment(
  reference: string,
): Promise<{ status: string; plan: string; redirect: string }> {
  const res = await fetch(`${API_BASE}/payments/verify/${reference}`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Payment verification failed");
  }
  return res.json();
}

export async function getPaymentStatus(): Promise<PaymentStatusResponse> {
  const res = await fetch(`${API_BASE}/payments/status`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to get payment status");
  return res.json();
}

// ---------- Billing History ----------

export interface BillingRecord {
  id: string;
  reference: string;
  amount: number; // in kobo
  currency: string;
  status: string;
  plan_type: string;
  seats: number;
  created_at: string;
}

export async function getBillingHistory(): Promise<{
  payments: BillingRecord[];
}> {
  const res = await fetch(`${API_BASE}/payments/billing-history`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to get billing history");
  return res.json();
}

// ---------- Email Verification ----------

export async function verifyEmail(
  email: string,
  code: string,
): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/auth/verify-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ email, code }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Verification failed");
  }
  return res.json();
}

export async function resendVerification(
  email: string,
): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/auth/resend-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Resend failed");
  }
  return res.json();
}

// ---------- Password ----------

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Password change failed");
  }
  return res.json();
}

// ---------- Admin ----------

export async function adminGetOverview() {
  const res = await fetch(`${API_BASE}/admin/overview`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Admin overview failed");
  return res.json();
}

export async function adminGetActionQueue() {
  const res = await fetch(`${API_BASE}/admin/action-queue`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Action queue failed");
  return res.json();
}

export async function adminGetUsers(params: {
  q?: string;
  status?: string;
  plan?: string;
  limit?: number;
  offset?: number;
}) {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.status) sp.set("status", params.status);
  if (params.plan) sp.set("plan", params.plan);
  sp.set("limit", String(params.limit || 50));
  sp.set("offset", String(params.offset || 0));
  const res = await fetch(`${API_BASE}/admin/users?${sp}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Admin users failed");
  return res.json();
}

export async function adminGetUserDetail(userId: string) {
  const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("User detail failed");
  return res.json();
}

export async function adminGetRevenue() {
  const res = await fetch(`${API_BASE}/admin/revenue`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Revenue failed");
  return res.json();
}

export async function adminGetTeams() {
  const res = await fetch(`${API_BASE}/admin/teams`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Teams failed");
  return res.json();
}

export async function adminResetPassword(
  userId: string,
): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/admin/reset-password/${userId}`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Reset password failed");
  return res.json();
}

export function adminExportUrl(
  type: "users" | "revenue" | "teams" | "action-queue",
): string {
  return `${API_BASE}/admin/export/${type}`;
}

export async function adminExportCsv(
  type: "users" | "revenue" | "teams" | "action-queue",
): Promise<void> {
  const res = await fetch(adminExportUrl(type), { headers: authHeaders() });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download =
    res.headers.get("content-disposition")?.match(/filename="(.+?)"/)?.[1] ||
    `lawlyfy-${type}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function adminOutreach(req: {
  user_id: string;
  scenario: string;
  custom_intent?: string;
  send?: boolean;
}) {
  const res = await fetch(`${API_BASE}/admin/outreach`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error("Outreach failed");
  return res.json();
}
