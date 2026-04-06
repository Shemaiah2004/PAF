export type AuthApiResponse = {
  userId: string;
  email: string;
  message: string;
  displayName?: string | null;
  photoUrl?: string | null;
  provider?: string | null;
  role?: string | null;
};

export type AuthSession = {
  userId: string;
  email: string;
  displayName?: string | null;
  photoUrl?: string | null;
  provider?: string | null;
  role?: string | null;
};

export const authApiBaseUrl = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8081"
).replace(/\/$/, "");

export const AUTH_CHANGE_EVENT = "paf-auth-change";

const AUTH_STORAGE_KEY = "paf.auth.session";

const isNullableString = (value: unknown) =>
  value === undefined || value === null || typeof value === "string";

const isAuthSession = (value: unknown): value is AuthSession => {
  return Boolean(
    value &&
      typeof value === "object" &&
      "userId" in value &&
      typeof value.userId === "string" &&
      "email" in value &&
      typeof value.email === "string" &&
      (!("displayName" in value) || isNullableString(value.displayName)) &&
      (!("photoUrl" in value) || isNullableString(value.photoUrl)) &&
      (!("provider" in value) || isNullableString(value.provider)) &&
      (!("role" in value) || isNullableString(value.role))
  );
};

const getAuthStorages = () => {
  if (typeof window === "undefined") {
    return [];
  }

  return [window.localStorage, window.sessionStorage];
};

const getStorageContainingAuthSession = () => {
  for (const storage of getAuthStorages()) {
    if (storage.getItem(AUTH_STORAGE_KEY)) {
      return storage;
    }
  }

  return null;
};

const emitAuthChange = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
  }
};

const resolveApiUrl = (input: string | URL) => {
  if (input instanceof URL) {
    return input.toString();
  }

  if (/^https?:\/\//i.test(input)) {
    return input;
  }

  return `${authApiBaseUrl}${input.startsWith("/") ? input : `/${input}`}`;
};

export const parseResponsePayload = <T>(rawResponse: string): T | null => {
  if (!rawResponse) {
    return null;
  }

  try {
    return JSON.parse(rawResponse) as T;
  } catch {
    return null;
  }
};

export const getApiMessage = (payload: unknown, fallbackMessage: string) => {
  if (
    payload &&
    typeof payload === "object" &&
    "message" in payload &&
    typeof payload.message === "string" &&
    payload.message.trim()
  ) {
    return payload.message.trim();
  }

  return fallbackMessage;
};

export const formatRoleLabel = (role?: string | null) => {
  const normalizedRole =
    typeof role === "string" && role.trim() ? role.trim().toLowerCase() : "user";

  return normalizedRole
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};

export const getStoredAuthSession = (): AuthSession | null => {
  for (const storage of getAuthStorages()) {
    const rawSession = storage.getItem(AUTH_STORAGE_KEY);

    if (!rawSession) {
      continue;
    }

    const parsedSession = parseResponsePayload<unknown>(rawSession);
    if (isAuthSession(parsedSession)) {
      return parsedSession;
    }
  }

  return null;
};

export const persistAuthSession = (
  session: AuthSession,
  keepUserSignedIn: boolean
) => {
  for (const storage of getAuthStorages()) {
    storage.removeItem(AUTH_STORAGE_KEY);
  }

  const selectedStorage = keepUserSignedIn
    ? window.localStorage
    : window.sessionStorage;

  selectedStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  emitAuthChange();
};

export const clearAuthSession = () => {
  for (const storage of getAuthStorages()) {
    storage.removeItem(AUTH_STORAGE_KEY);
  }

  emitAuthChange();
};

export const replaceStoredAuthSession = (session: AuthSession) => {
  if (typeof window === "undefined") {
    return;
  }

  const selectedStorage =
    getStorageContainingAuthSession() ?? window.sessionStorage;

  for (const storage of getAuthStorages()) {
    storage.removeItem(AUTH_STORAGE_KEY);
  }

  selectedStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  emitAuthChange();
};

export const buildAuthSession = (
  response: Partial<AuthApiResponse>
): AuthSession | null => {
  if (typeof response.userId !== "string" || typeof response.email !== "string") {
    return null;
  }

  return {
    userId: response.userId,
    email: response.email,
    displayName:
      typeof response.displayName === "string" ? response.displayName : null,
    photoUrl: typeof response.photoUrl === "string" ? response.photoUrl : null,
    provider: typeof response.provider === "string" ? response.provider : null,
    role: typeof response.role === "string" ? response.role : "USER",
  };
};

export const isAdminRole = (role?: string | null) =>
  typeof role === "string" && role.trim().toUpperCase() === "ADMIN";

export const getUserDisplayName = (email: string) => {
  const [localPart = "Signed In User"] = email.split("@");
  const displayName = localPart
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  return displayName || "Signed In User";
};

export const apiFetch = async (
  input: string | URL,
  init: RequestInit = {}
) => {
  const response = await fetch(resolveApiUrl(input), {
    ...init,
    credentials: "include",
  });

  if (response.status === 401) {
    clearAuthSession();
  }

  return response;
};

export const restoreAuthSessionFromServer = async () => {
  const response = await apiFetch("/api/auth/me");

  if (!response.ok) {
    return null;
  }

  const rawResponse = await response.text();
  const payload = parseResponsePayload<Partial<AuthApiResponse>>(rawResponse);
  return payload ? buildAuthSession(payload) : null;
};

export const signOutFromServer = async () => {
  const response = await apiFetch("/api/auth/signout", {
    method: "POST",
  });

  if (!response.ok && response.status !== 401) {
    throw new Error("Unable to sign out right now.");
  }

  clearAuthSession();
  return response;
};
