/**
 * Lawlyfy API client with SSE streaming support and auth.
 */

const API_BASE = import.meta.env.VITE_API_URL || "/api";

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

export interface ChatRequest {
  message: string;
  thread_id?: string;
  web_enabled?: boolean;
  jurisdiction_filter?: string[];
}

export interface StreamEvent {
  type: "token" | "citations" | "done";
  content?: string;
  citations?: Citation[];
  thread_id?: string;
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

export async function getDocumentPages(
  localPath: string,
): Promise<DocumentPagesResponse> {
  const res = await fetch(
    `${API_BASE}/documents/pages?local_path=${encodeURIComponent(localPath)}`,
  );
  if (!res.ok) throw new Error(`Document pages request failed: ${res.status}`);
  return res.json();
}

export function downloadDocumentPdf(localPath: string, filename?: string) {
  const url = getDocumentPdfUrl(localPath);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || localPath.split("/").pop() || "document.pdf";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
