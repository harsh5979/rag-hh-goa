function normalizeUrl(baseUrl: string, path: string): string {
  const cleanBase = (baseUrl || "").replace(/\/+$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  if (!cleanBase) return cleanPath;

  // Prevent double /api/api
  if (cleanBase.endsWith("/api") && cleanPath.startsWith("/api/")) {
    return `${cleanBase}${cleanPath.substring(4)}`;
  }
  return `${cleanBase}${cleanPath}`;
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async request<T>(
    path: string,
    options: {
      method: "GET" | "POST";
      body?: unknown;
      headers?: Record<string, string>;
    }
  ): Promise<T> {
    const url = normalizeUrl(this.baseUrl, path);
    const start = performance.now();

    // 2 Retries for transient network reconnections
    let lastError: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(url, {
          method: options.method,
          headers: {
            "Content-Type": "application/json",
            ...options.headers,
          },
          body: options.body instanceof FormData ? options.body : (options.body ? JSON.stringify(options.body) : undefined),
        });

        if (!response.ok) {
          throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data as T;
      } catch (error) {
        lastError = error;
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        }
      }
    }

    console.error(`[API Client] ${options.method} ${path} failed in ${Math.round(performance.now() - start)}ms:`, lastError);
    throw lastError;
  }

  async get<T>(path: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(path, { method: "GET", headers });
  }

  async post<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(path, { method: "POST", body, headers });
  }

  async postFormData<T>(path: string, formData: FormData): Promise<T> {
    const url = normalizeUrl(this.baseUrl, path);
    const start = performance.now();

    let lastError: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(url, {
          method: "POST",
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }
        return (await response.json()) as T;
      } catch (error) {
        lastError = error;
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        }
      }
    }

    console.error(`[API Client] POST (FormData) ${path} failed in ${Math.round(performance.now() - start)}ms:`, lastError);
    throw lastError;
  }
}

// Resilient API base URL using Next.js rewrite proxy /api or explicit env URL
const getInitialApiUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    const envUrl = process.env.NEXT_PUBLIC_API_URL;
    return envUrl.includes("/api") ? envUrl : `${envUrl.replace(/\/+$/, "")}/api`;
  }
  return "/api";
};

export const apiClient = new ApiClient(getInitialApiUrl());

