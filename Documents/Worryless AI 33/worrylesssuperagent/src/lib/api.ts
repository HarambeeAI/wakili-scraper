const BASE_URL = import.meta.env.VITE_API_URL as string;

if (!BASE_URL) {
  console.error('[api] VITE_API_URL is not set — all API calls will fail');
}

interface ApiOptions {
  token?: string | null;
  signal?: AbortSignal;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: ApiOptions = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: options.signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${method} ${path} failed (${res.status}): ${text}`);
  }
  // Handle 204 No Content
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, options?: ApiOptions) =>
    request<T>('GET', path, undefined, options),
  post: <T>(path: string, body: unknown, options?: ApiOptions) =>
    request<T>('POST', path, body, options),
  patch: <T>(path: string, body: unknown, options?: ApiOptions) =>
    request<T>('PATCH', path, body, options),
  delete: <T>(path: string, options?: ApiOptions) =>
    request<T>('DELETE', path, undefined, options),
};
