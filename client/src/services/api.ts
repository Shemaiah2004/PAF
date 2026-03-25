const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8081/api";
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

type ApiMethod = "GET" | "POST" | "PUT" | "DELETE";

interface ApiRequestOptions {
  method?: ApiMethod;
  body?: BodyInit | object;
}

const getAuthHeaders = () => {
  const email =
    localStorage.getItem("paf_auth_email") ?? import.meta.env.VITE_API_USERNAME;
  const password =
    localStorage.getItem("paf_auth_password") ??
    import.meta.env.VITE_API_PASSWORD;

  const headers = new Headers();
  if (email && password) {
    headers.set("Authorization", `Basic ${btoa(`${email}:${password}`)}`);
  }

  return headers;
};

const request = async <T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<{ data: T }> => {
  const headers = getAuthHeaders();
  let body: BodyInit | undefined;

  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body,
  });

  const data = (await response.json()) as T;

  if (!response.ok) {
    const message =
      typeof data === "object" &&
      data !== null &&
      "message" in data &&
      typeof data.message === "string"
        ? data.message
        : "Request failed";
    throw new Error(message);
  }

  return { data };
};

const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: BodyInit | object) =>
    request<T>(path, { method: "POST", body }),
  put: <T>(path: string, body?: BodyInit | object) =>
    request<T>(path, { method: "PUT", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export default api;
