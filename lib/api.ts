const LOCAL_API_BASE = "http://localhost:8000";
const PRODUCTION_API_BASE = "https://blog-api.ingyuc.click";
const PRODUCTION_FRONTEND_HOSTS = new Set(["blog.ingyc.click", "blog.ingyuc.click"]);

function apiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
  if (typeof window !== "undefined" && PRODUCTION_FRONTEND_HOSTS.has(window.location.hostname)) {
    if (!configured || configured.includes("localhost")) return PRODUCTION_API_BASE;
  }
  return configured || LOCAL_API_BASE;
}

export function assetUrl(path: string) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) return path;
  return `${apiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isFormData = init.body instanceof FormData;
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    let message = "요청을 처리하지 못했습니다.";
    try {
      const data = await response.json();
      message = data.detail || message;
    } catch {
      // Keep the default message for non-JSON errors.
    }
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function apiGet<T>(path: string) {
  return request<T>(path);
}

export function apiPost<T>(path: string, body: unknown) {
  return request<T>(path, {
    method: "POST",
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
}

export function apiPut<T>(path: string, body: unknown) {
  return request<T>(path, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function apiDelete<T>(path: string) {
  return request<T>(path, { method: "DELETE" });
}
