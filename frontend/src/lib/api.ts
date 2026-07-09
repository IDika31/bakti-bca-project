const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface ApiOptions extends RequestInit {
  token?: string;
}

async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { token, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...fetchOptions,
    headers,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }

  return data;
}

export const api = {
  get: <T>(path: string, opts?: ApiOptions) => request<T>(path, { ...opts, method: "GET" }),
  post: <T>(path: string, body: unknown, opts?: ApiOptions) =>
    request<T>(path, { ...opts, method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown, opts?: ApiOptions) =>
    request<T>(path, { ...opts, method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown, opts?: ApiOptions) =>
    request<T>(path, { ...opts, method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string, opts?: ApiOptions) =>
    request<T>(path, { ...opts, method: "DELETE" }),
};
