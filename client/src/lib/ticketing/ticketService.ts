import {
  getStoredAuthSession,
  getUserDisplayName,
  parseResponsePayload,
} from "../auth";
import {
  applyTicketFilters,
  buildDashboardSummary,
  buildReports,
  canManageTickets,
  canTransitionTicket,
  getAllowedStatusOptions,
  isTicketOverdue,
  synchronizeTicketComputedFields,
} from "./helpers";
import {
  normalizeTicketCategory,
  STUDENT_TICKET_CATEGORIES,
} from "./catalog";
import { initialMockTicketingData, type TicketingMockDatabase } from "./mockData";
import type {
  CreateTicketInput,
  DashboardSummary,
  TicketFilters,
  TicketListResult,
  TicketMeta,
  TicketRecord,
  TicketReports,
  TicketRole,
  TicketStatus,
  TicketUser,
  UpdateTicketInput,
} from "./types";

const STORAGE_KEY = "paf.ticketing.mock-db.v1";
const TICKET_DATA_CHANGE_EVENT = "paf.ticketing.data-changed";
const API_ENABLED = (import.meta.env.VITE_TICKETING_ENABLE_API ?? "true") !== "false";
const MOCK_FALLBACK_ENABLED =
  import.meta.env.VITE_TICKETING_ENABLE_MOCK_FALLBACK === "true";
const API_BASE_URL = (
  import.meta.env.VITE_TICKETING_API_BASE_URL ?? "http://localhost:4000"
).replace(/\/$/, "");

function getTicketingApiToken() {
  if (typeof window === "undefined") {
    return import.meta.env.VITE_TICKETING_API_TOKEN ?? null;
  }

  return (
    import.meta.env.VITE_TICKETING_API_TOKEN ??
    window.localStorage.getItem("paf.ticketing.jwt") ??
    window.sessionStorage.getItem("paf.ticketing.jwt")
  );
}

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function getCurrentRole(role?: string | null): TicketRole {
  if (role === "ADMIN" || role === "TECHNICIAN") {
    return role;
  }

  return "USER";
}

function buildSessionHeaders(headers: Headers) {
  const session = getStoredAuthSession();
  if (!session) {
    return;
  }

  headers.set("X-Auth-User-Id", session.userId);
  headers.set("X-Auth-User-Email", session.email);
  headers.set(
    "X-Auth-User-Name",
    session.displayName?.trim() || getUserDisplayName(session.email)
  );
  headers.set("X-Auth-User-Role", getCurrentRole(session.role));

  if (session.provider?.trim()) {
    headers.set("X-Auth-User-Provider", session.provider.trim());
  }
}

function getCurrentTicketUser(db: TicketingMockDatabase): TicketUser {
  const session = getStoredAuthSession();
  if (!session) {
    return db.users.find((user) => user.role === "USER") ?? db.users[0];
  }

  const mappedRole = getCurrentRole(session.role);
  const existingUser = db.users.find((user) => user.email === session.email);
  if (existingUser) {
    return {
      ...existingUser,
      fullName: session.displayName ?? existingUser.fullName,
      role: mappedRole,
    };
  }

  return {
    id: session.userId,
    fullName: session.displayName ?? getUserDisplayName(session.email),
    email: session.email,
    role: mappedRole,
  };
}

function normalizeTickets(tickets: TicketRecord[]) {
  return tickets.map((ticket) =>
    synchronizeTicketComputedFields({
      ...ticket,
      category: normalizeTicketCategory(ticket.category),
    })
  );
}

function readMockDb(): TicketingMockDatabase {
  const normalizedInitialData: TicketingMockDatabase = {
    ...initialMockTicketingData,
    tickets: normalizeTickets(initialMockTicketingData.tickets),
  };

  if (typeof window === "undefined") {
    return normalizedInitialData;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedInitialData));
    return normalizedInitialData;
  }

  try {
    const parsed = JSON.parse(raw) as TicketingMockDatabase;
    return {
      ...parsed,
      tickets: normalizeTickets(parsed.tickets),
    };
  } catch {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedInitialData));
    return normalizedInitialData;
  }
}

function writeMockDb(db: TicketingMockDatabase) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...db,
      tickets: normalizeTickets(db.tickets),
    })
  );
  window.dispatchEvent(new CustomEvent(TICKET_DATA_CHANGE_EVENT));
}

function buildMeta(db: TicketingMockDatabase): TicketMeta {
  return {
    types: ["MAINTENANCE", "INCIDENT"],
    priorities: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
    statuses: ["OPEN", "IN_PROGRESS", "ON_HOLD", "RESOLVED", "CLOSED", "CANCELLED"],
    categories: [...STUDENT_TICKET_CATEGORIES],
    technicians: db.users.filter((user) => user.role === "TECHNICIAN" || user.role === "ADMIN"),
  };
}

function createTicketId(tickets: TicketRecord[]) {
  const sequence = String(tickets.length + 1).padStart(4, "0");
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `TCK-${datePart}-${sequence}`;
}

function accessScopeTickets(db: TicketingMockDatabase) {
  const currentUser = getCurrentTicketUser(db);
  if (currentUser.role === "USER") {
    return db.tickets.filter((ticket) => ticket.reporter.email === currentUser.email);
  }

  return db.tickets;
}

function assertWorkflowPermission(role?: string | null) {
  if (!canManageTickets(role)) {
    throw new Error("Only technicians and admins can update ticket workflow.");
  }
}

function normalizeTicketUser(
  user:
    | (Partial<TicketUser> & {
        id?: string;
        userId?: string;
      })
    | null
    | undefined
): TicketUser {
  return {
    id:
      typeof user?.id === "string"
        ? user.id
        : typeof user?.userId === "string"
          ? user.userId
          : "",
    fullName: user?.fullName ?? "Unknown User",
    email: user?.email ?? "",
    role: getCurrentRole(user?.role),
    department: user?.department,
    skills: Array.isArray(user?.skills) ? user.skills : [],
  };
}

function normalizeTicketRecord(ticket: TicketRecord): TicketRecord {
  return {
    ...ticket,
    category: normalizeTicketCategory(ticket.category),
    reporter: normalizeTicketUser(ticket.reporter),
    assignedTechnician: ticket.assignedTechnician
      ? normalizeTicketUser(ticket.assignedTechnician)
      : null,
    attachments: (ticket.attachments ?? []).map((attachment) => ({
      ...attachment,
      id: attachment.id ?? attachment.fileName,
      uploadedBy: normalizeTicketUser(attachment.uploadedBy),
    })),
    comments: (ticket.comments ?? []).map((comment) => ({
      ...comment,
      id: comment.id,
      author: normalizeTicketUser(comment.author),
    })),
    activity: (ticket.activity ?? []).map((item) => ({
      ...item,
      id: item.id,
      actor: normalizeTicketUser(item.actor),
    })),
  };
}

async function withOptionalMockFallback<T>(
  apiRequest: () => Promise<T>,
  fallbackRequest: () => T | Promise<T>
) {
  try {
    return await apiRequest();
  } catch (error) {
    if (!MOCK_FALLBACK_ENABLED) {
      throw error;
    }

    return fallbackRequest();
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? {});
  if (!headers.has("Content-Type") && !(init?.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  buildSessionHeaders(headers);

  const apiToken = getTicketingApiToken();
  if (apiToken) {
    headers.set("Authorization", `Bearer ${apiToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const rawResponse = await response.text();
    const payload = parseResponsePayload<{ message?: string }>(rawResponse);
    const message =
      payload?.message?.trim() ||
      `Ticketing API request failed with ${response.status}.`;

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const rawResponse = await response.text();
  if (!rawResponse) {
    return undefined as T;
  }

  const payload = parseResponsePayload<T>(rawResponse);
  if (payload === null) {
    throw new Error("Ticketing API returned an invalid JSON payload.");
  }

  return payload;
}

function fetchTicketsFromMock(filters: TicketFilters = {}): TicketListResult {
  const db = readMockDb();
  const items = applyTicketFilters(accessScopeTickets(db), filters).sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
  );

  return {
    items,
    total: items.length,
  };
}

function fetchTicketByIdFromMock(ticketId: string): TicketRecord {
  const db = readMockDb();
  const ticket = accessScopeTickets(db).find((item) => item.id === ticketId);

  if (!ticket) {
    throw new Error("Ticket not found");
  }

  return ticket;
}

function createTicketInMock(input: CreateTicketInput): TicketRecord {
  const db = readMockDb();
  const currentUser = getCurrentTicketUser(db);
  const now = new Date();

  const attachments =
    input.attachments?.map((file) => ({
      id: uid("attachment"),
      fileName: file.name.replace(/\s+/g, "-").toLowerCase(),
      originalName: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      url: "#",
      uploadedAt: now.toISOString(),
      uploadedBy: {
        id: currentUser.id,
        fullName: currentUser.fullName,
        role: currentUser.role,
      },
    })) ?? [];

  const newTicket: TicketRecord = {
    id: uid("ticket"),
    ticketId: createTicketId(db.tickets),
    title: input.title.trim(),
    description: input.description.trim(),
    type: input.type,
    priority: input.priority,
    category: normalizeTicketCategory(input.category.trim()),
    status: "OPEN",
    requiresExtendedResolution: Boolean(input.requiresExtendedResolution),
    location: {
      ...input.location,
      note: input.type === "INCIDENT" ? input.location.note : "",
    },
    reporter: currentUser,
    assignedTechnician: null,
    slaHours: 0,
    dueAt: now.toISOString(),
    overdue: false,
    attachments,
    comments: [],
    activity: [
      {
        id: uid("activity"),
        action: "TICKET_CREATED",
        message: `Ticket created with ${input.priority} priority.`,
        createdAt: now.toISOString(),
        actor: {
          id: currentUser.id,
          fullName: currentUser.fullName,
          role: currentUser.role,
        },
      },
    ],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  db.tickets = [synchronizeTicketComputedFields(newTicket), ...db.tickets];
  writeMockDb(db);
  return db.tickets[0];
}

function updateTicketInMock(ticketId: string, input: UpdateTicketInput) {
  const db = readMockDb();
  const currentUser = getCurrentTicketUser(db);
  assertWorkflowPermission(currentUser.role);
  const ticketIndex = db.tickets.findIndex((ticket) => ticket.id === ticketId);

  if (ticketIndex < 0) {
    throw new Error("Ticket not found");
  }

  const previous = db.tickets[ticketIndex];
  const nextPriority = input.priority ?? previous.priority;
  const nextRequiresExtendedResolution =
    input.requiresExtendedResolution ?? previous.requiresExtendedResolution;
  const nextStatus = input.status ?? previous.status;

  if (
    input.status &&
    input.status !== previous.status &&
    !canTransitionTicket(
      {
        status: previous.status,
        priority: nextPriority,
        requiresExtendedResolution: nextRequiresExtendedResolution,
      },
      input.status
    )
  ) {
    const allowedStatuses = getAllowedStatusOptions({
      status: previous.status,
      priority: nextPriority,
      requiresExtendedResolution: nextRequiresExtendedResolution,
    })
      .map((status) => status.replace(/_/g, " "))
      .join(", ");

    throw new Error(
      `This ticket cannot move from ${previous.status.replace(/_/g, " ")} to ${input.status.replace(
        /_/g,
        " "
      )}. Allowed next stages: ${allowedStatuses}.`
    );
  }

  const updated = synchronizeTicketComputedFields({
    ...previous,
    ...input,
    priority: nextPriority,
    status: nextStatus,
    requiresExtendedResolution: Boolean(nextRequiresExtendedResolution),
    updatedAt: new Date().toISOString(),
  } satisfies TicketRecord);

  if (input.status === "RESOLVED" && previous.status !== "RESOLVED") {
    updated.resolvedAt = updated.updatedAt;
  }

  if (input.status === "CLOSED" && previous.status !== "CLOSED") {
    updated.closedAt = updated.updatedAt;
  }

  if (input.status && !["RESOLVED", "CLOSED"].includes(input.status)) {
    updated.closedAt = null;
    if (input.status !== "RESOLVED") {
      updated.resolvedAt = null;
    }
  }

  const nextActivity: TicketRecord["activity"] = [];

  if (input.assignedTechnician && input.assignedTechnician.id !== previous.assignedTechnician?.id) {
    nextActivity.push({
      id: uid("activity"),
      action: "TECHNICIAN_ASSIGNED",
      message: `${input.assignedTechnician.fullName} was assigned to the ticket.`,
      createdAt: updated.updatedAt,
      actor: {
        id: currentUser.id,
        fullName: currentUser.fullName,
        role: currentUser.role,
      },
    });
  }

  if (
    input.requiresExtendedResolution !== undefined &&
    Boolean(input.requiresExtendedResolution) !== Boolean(previous.requiresExtendedResolution)
  ) {
    nextActivity.push({
      id: uid("activity"),
      action: "SLA_UPDATED",
      message: input.requiresExtendedResolution
        ? "Extended resolution time enabled for a major or large repair."
        : "Ticket moved back to the standard SLA window.",
      createdAt: updated.updatedAt,
      actor: {
        id: currentUser.id,
        fullName: currentUser.fullName,
        role: currentUser.role,
      },
    });
  }

  if (input.status && input.status !== previous.status) {
    nextActivity.push({
      id: uid("activity"),
      action: "STATUS_CHANGED",
      message: `Ticket moved to ${input.status.replace(/_/g, " ")}.`,
      createdAt: updated.updatedAt,
      actor: {
        id: currentUser.id,
        fullName: currentUser.fullName,
        role: currentUser.role,
      },
    });
  } else if (input.priority || input.description || input.category || input.location) {
    nextActivity.push({
      id: uid("activity"),
      action: "TICKET_UPDATED",
      message: "Ticket updated.",
      createdAt: updated.updatedAt,
      actor: {
        id: currentUser.id,
        fullName: currentUser.fullName,
        role: currentUser.role,
      },
    });
  }

  updated.overdue = isTicketOverdue(updated);
  updated.activity = [...nextActivity, ...updated.activity];

  db.tickets[ticketIndex] = updated;
  writeMockDb(db);
  return updated;
}

function assignTechnicianInMock(ticketId: string, technicianId: string) {
  const db = readMockDb();
  const currentUser = getCurrentTicketUser(db);
  if (currentUser.role !== "ADMIN") {
    throw new Error("Only admins can assign technicians.");
  }

  const technician = db.users.find((user) => user.id === technicianId);
  if (!technician) {
    throw new Error("Technician not found");
  }

  return updateTicketInMock(ticketId, {
    status: "IN_PROGRESS",
    assignedTechnician: technician,
  });
}

function addTicketCommentInMock(ticketId: string, message: string) {
  const db = readMockDb();
  const currentUser = getCurrentTicketUser(db);
  const ticket = db.tickets.find((item) => item.id === ticketId);
  if (!ticket) {
    throw new Error("Ticket not found");
  }

  const comment = {
    id: uid("comment"),
    message: message.trim(),
    createdAt: new Date().toISOString(),
    author: {
      id: currentUser.id,
      fullName: currentUser.fullName,
      role: currentUser.role,
    },
  };

  ticket.comments = [...ticket.comments, comment];
  ticket.activity = [
    {
      id: uid("activity"),
      action: "COMMENT_ADDED",
      message: "Comment added.",
      createdAt: comment.createdAt,
      actor: comment.author,
    },
    ...ticket.activity,
  ];
  ticket.updatedAt = comment.createdAt;

  writeMockDb(db);
  return ticket;
}

function uploadTicketAttachmentsInMock(ticketId: string, files: File[]) {
  const db = readMockDb();
  const currentUser = getCurrentTicketUser(db);
  const ticket = db.tickets.find((item) => item.id === ticketId);
  if (!ticket) {
    throw new Error("Ticket not found");
  }

  const uploadedAt = new Date().toISOString();
  const attachments = files.map((file) => ({
    id: uid("attachment"),
    fileName: file.name.replace(/\s+/g, "-").toLowerCase(),
    originalName: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    url: "#",
    uploadedAt,
    uploadedBy: {
      id: currentUser.id,
      fullName: currentUser.fullName,
      role: currentUser.role,
    },
  }));

  ticket.attachments = [...ticket.attachments, ...attachments];
  ticket.activity = [
    {
      id: uid("activity"),
      action: "ATTACHMENT_UPLOADED",
      message: `${attachments.length} attachment(s) uploaded.`,
      createdAt: uploadedAt,
      actor: {
        id: currentUser.id,
        fullName: currentUser.fullName,
        role: currentUser.role,
      },
    },
    ...ticket.activity,
  ];
  ticket.updatedAt = uploadedAt;
  writeMockDb(db);
  return ticket;
}

function deleteTicketInMock(ticketId: string) {
  const db = readMockDb();
  db.tickets = db.tickets.filter((ticket) => ticket.id !== ticketId);
  writeMockDb(db);
}

export async function fetchTicketMeta(): Promise<TicketMeta> {
  if (API_ENABLED) {
    return withOptionalMockFallback(
      async () => {
        const response = await apiFetch<TicketMeta>("/api/tickets/meta");
        return {
          ...response,
          technicians: response.technicians.map(normalizeTicketUser),
        };
      },
      () => buildMeta(readMockDb())
    );
  }

  return buildMeta(readMockDb());
}

export async function fetchTickets(filters: TicketFilters = {}): Promise<TicketListResult> {
  if (API_ENABLED) {
    return withOptionalMockFallback(
      async () => {
        const params = new URLSearchParams();
        if (filters.search) params.set("search", filters.search);
        if (filters.type) params.set("type", filters.type);
        if (filters.priority) params.set("priority", filters.priority);
        if (filters.status) params.set("status", filters.status);
        if (filters.category) params.set("category", filters.category);
        if (filters.location) params.set("location", filters.location);
        if (filters.assignedTechnicianId) {
          params.set("assignedTechnicianId", filters.assignedTechnicianId);
        }
        if (filters.overdueOnly) params.set("overdue", "true");

        const response = await apiFetch<{
          items: TicketRecord[];
          pagination?: { total: number };
        }>(`/api/tickets${params.toString() ? `?${params.toString()}` : ""}`);

        return {
          items: response.items.map(normalizeTicketRecord),
          total: response.pagination?.total ?? response.items.length,
        };
      },
      () => fetchTicketsFromMock(filters)
    );
  }

  return fetchTicketsFromMock(filters);
}

export async function fetchTicketById(ticketId: string): Promise<TicketRecord> {
  if (API_ENABLED) {
    return withOptionalMockFallback(
      async () => normalizeTicketRecord(await apiFetch<TicketRecord>(`/api/tickets/${ticketId}`)),
      () => fetchTicketByIdFromMock(ticketId)
    );
  }

  return fetchTicketByIdFromMock(ticketId);
}

export async function createTicket(input: CreateTicketInput): Promise<TicketRecord> {
  if (API_ENABLED) {
    const created = normalizeTicketRecord(
      await apiFetch<TicketRecord>("/api/tickets", {
        method: "POST",
        body: JSON.stringify({
          title: input.title.trim(),
          description: input.description.trim(),
          type: input.type,
          priority: input.priority,
          category: input.category.trim(),
          location: {
            ...input.location,
            building: input.location.building.trim(),
            floor: input.location.floor?.trim() ?? "",
            room: input.location.room?.trim() ?? "",
            campus: input.location.campus?.trim() ?? "",
            note: input.location.note?.trim() ?? "",
          },
        }),
      })
    );

    if (input.attachments?.length) {
      const formData = new FormData();
      input.attachments.forEach((file) => formData.append("attachments", file));
      return normalizeTicketRecord(
        await apiFetch<TicketRecord>(`/api/tickets/${created.id}/attachments`, {
          method: "POST",
          body: formData,
        })
      );
    }

    return created;
  }

  return createTicketInMock(input);
}

export async function updateTicket(ticketId: string, input: UpdateTicketInput) {
  if (API_ENABLED) {
    return withOptionalMockFallback(
      async () =>
        normalizeTicketRecord(
          await apiFetch<TicketRecord>(`/api/tickets/${ticketId}`, {
            method: "PUT",
            body: JSON.stringify(input),
          })
        ),
      () => updateTicketInMock(ticketId, input)
    );
  }

  return updateTicketInMock(ticketId, input);
}

export async function assignTechnician(ticketId: string, technicianId: string) {
  if (API_ENABLED) {
    return withOptionalMockFallback(
      async () =>
        normalizeTicketRecord(
          await apiFetch<TicketRecord>(`/api/tickets/${ticketId}/assign`, {
            method: "PATCH",
            body: JSON.stringify({ technicianId }),
          })
        ),
      () => assignTechnicianInMock(ticketId, technicianId)
    );
  }

  return assignTechnicianInMock(ticketId, technicianId);
}

export async function addTicketComment(ticketId: string, message: string) {
  if (API_ENABLED) {
    return withOptionalMockFallback(
      async () =>
        normalizeTicketRecord(
          await apiFetch<TicketRecord>(`/api/tickets/${ticketId}/comments`, {
            method: "POST",
            body: JSON.stringify({ message }),
          })
        ),
      () => addTicketCommentInMock(ticketId, message)
    );
  }

  return addTicketCommentInMock(ticketId, message);
}

export async function uploadTicketAttachments(ticketId: string, files: File[]) {
  if (API_ENABLED) {
    return withOptionalMockFallback(
      async () => {
        const formData = new FormData();
        files.forEach((file) => formData.append("attachments", file));
        return normalizeTicketRecord(
          await apiFetch<TicketRecord>(`/api/tickets/${ticketId}/attachments`, {
            method: "POST",
            body: formData,
          })
        );
      },
      () => uploadTicketAttachmentsInMock(ticketId, files)
    );
  }

  return uploadTicketAttachmentsInMock(ticketId, files);
}

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  if (API_ENABLED) {
    return withOptionalMockFallback(
      async () => {
        const response = await apiFetch<{
          cards: DashboardSummary["cards"];
          charts: {
            statusBreakdown: Array<{ _id: string; count: number }>;
            priorityBreakdown: Array<{ _id: string; count: number }>;
            typeBreakdown: Array<{ _id: string; count: number }>;
            monthlyTrend: Array<{ label: string; created: number }>;
          };
          recentTickets: TicketRecord[];
        }>("/api/dashboard");

        return {
          cards: response.cards,
          slaBuckets: [],
          charts: {
            statusBreakdown: response.charts.statusBreakdown.map((item) => ({
              label: item._id,
              value: item.count,
            })),
            priorityBreakdown: response.charts.priorityBreakdown.map((item) => ({
              label: item._id,
              value: item.count,
            })),
            typeBreakdown: response.charts.typeBreakdown.map((item) => ({
              label: item._id,
              value: item.count,
            })),
            monthlyTrend: response.charts.monthlyTrend,
          },
          recentTickets: response.recentTickets.map(normalizeTicketRecord),
        };
      },
      () => buildDashboardSummary(accessScopeTickets(readMockDb()))
    );
  }

  return buildDashboardSummary(accessScopeTickets(readMockDb()));
}

export async function fetchReports(): Promise<TicketReports> {
  if (API_ENABLED) {
    return withOptionalMockFallback(
      async () => {
        const response = await apiFetch<{
          summary: TicketReports["summary"];
          categoryBreakdown: Array<{ _id: string; count: number }>;
          technicianWorkload: Array<{ _id: string; count: number }>;
          typeBreakdown: Array<{ _id: string; count: number }>;
        }>("/api/reports");

        return {
          summary: response.summary,
          categoryBreakdown: response.categoryBreakdown.map((item) => ({
            label: item._id,
            value: item.count,
          })),
          technicianWorkload: response.technicianWorkload.map((item) => ({
            label: item._id,
            value: item.count,
          })),
          typeBreakdown: response.typeBreakdown.map((item) => ({
            label: item._id,
            value: item.count,
          })),
        };
      },
      () => buildReports(accessScopeTickets(readMockDb()))
    );
  }

  return buildReports(accessScopeTickets(readMockDb()));
}

export async function deleteTicket(ticketId: string) {
  if (API_ENABLED) {
    return withOptionalMockFallback(
      async () => {
        await apiFetch<void>(`/api/tickets/${ticketId}`, {
          method: "DELETE",
        });
      },
      () => deleteTicketInMock(ticketId)
    );
  }

  deleteTicketInMock(ticketId);
}

export function subscribeToTicketDataChanges(listener: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleCustomEvent = () => listener();
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      listener();
    }
  };

  window.addEventListener(TICKET_DATA_CHANGE_EVENT, handleCustomEvent);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(TICKET_DATA_CHANGE_EVENT, handleCustomEvent);
    window.removeEventListener("storage", handleStorage);
  };
}

export function getCurrentUserRole() {
  return getCurrentRole(getStoredAuthSession()?.role);
}

export function getAvailableStatuses(): TicketStatus[] {
  return ["OPEN", "IN_PROGRESS", "ON_HOLD", "RESOLVED", "CLOSED", "CANCELLED"];
}
