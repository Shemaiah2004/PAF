const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "/api";
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

type ApiMethod = "GET" | "POST" | "PUT" | "DELETE";

interface ApiRequestOptions {
  method?: ApiMethod;
  body?: BodyInit | object;
}

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

const getAuthHeaders = () => {
  const headers = new Headers();
  return headers;
};

const parseResponseBody = async (response: Response) => {
  const rawBody = await response.text();

  if (!rawBody) {
    return null;
  }

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return rawBody;
  }
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
    credentials: "include",
  });

  const data = (await parseResponseBody(response)) as T;

  if (!response.ok) {
    const message =
      typeof data === "object" &&
        data !== null &&
        "message" in data &&
        typeof data.message === "string"
        ? data.message
        : "Request failed";
    throw new ApiError(message, response.status, data);
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
