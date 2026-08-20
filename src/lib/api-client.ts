export class ApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

type ApiEnvelope<T> = { success: true; data: T } | { success: false; error: { code: string; message: string } };

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });

  let json: ApiEnvelope<T>;
  try {
    json = await res.json();
  } catch {
    throw new ApiError(
      "NETWORK_ERROR",
      "No pudimos comunicarnos con el servidor. Verifica tu conexión e intenta de nuevo.",
      res.status
    );
  }

  if (!json.success) {
    throw new ApiError(json.error.code, json.error.message, res.status);
  }
  return json.data;
}

export function apiGet<T>(path: string) {
  return apiFetch<T>(path, { method: "GET" });
}

export function apiPost<T>(path: string, body?: unknown) {
  return apiFetch<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });
}

export function apiPatch<T>(path: string, body?: unknown) {
  return apiFetch<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined });
}
