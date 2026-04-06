import { formatRoleLabel } from "./auth";
import { getRoleBadgeColor, normalizeRole, type UserRoleValue } from "./userRoles";

export type RoleRequestStatusValue = "PENDING" | "APPROVED" | "REJECTED";
export type RoleRequestEventTypeValue =
  | "CREATED"
  | "UPDATED"
  | "APPROVED"
  | "REJECTED"
  | "DELETED";

export type RoleRequestApiItem = {
  id: string;
  requesterUserId: string;
  requesterEmail: string;
  requesterDisplayName?: string | null;
  currentRole?: string | null;
  requestedRole?: string | null;
  description?: string | null;
  status?: string | null;
  rejectionReason?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  reviewedAt?: string | null;
};

export type RoleRequestItem = {
  id: string;
  requesterUserId: string;
  requesterEmail: string;
  requesterDisplayName: string;
  currentRole: UserRoleValue;
  requestedRole: UserRoleValue;
  description: string;
  status: RoleRequestStatusValue;
  rejectionReason: string;
  createdAt: string | null;
  updatedAt: string | null;
  reviewedAt: string | null;
};

export type RoleRequestMutationApiResponse = {
  message?: string;
  request: RoleRequestApiItem;
  user?: {
    id: string;
    role?: string | null;
  } | null;
};

export type RoleRequestDeleteApiResponse = {
  message?: string;
  requestId?: string;
};

export type RoleRequestRealtimeApiEvent = {
  eventType?: string | null;
  message?: string | null;
  actorUserId?: string | null;
  requestId?: string | null;
  request?: RoleRequestApiItem | null;
  user?: {
    id: string;
    role?: string | null;
  } | null;
};

export type RoleRequestRealtimeEvent = {
  eventType: RoleRequestEventTypeValue;
  message: string;
  actorUserId: string | null;
  requestId: string;
  request: RoleRequestItem | null;
  user: {
    id: string;
    role: UserRoleValue;
  } | null;
};

const availableStatuses: RoleRequestStatusValue[] = [
  "PENDING",
  "APPROVED",
  "REJECTED",
];

const availableEventTypes: RoleRequestEventTypeValue[] = [
  "CREATED",
  "UPDATED",
  "APPROVED",
  "REJECTED",
  "DELETED",
];

export const isRoleRequestApiItem = (
  value: unknown
): value is RoleRequestApiItem => {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      typeof value.id === "string" &&
      "requesterUserId" in value &&
      typeof value.requesterUserId === "string" &&
      "requesterEmail" in value &&
      typeof value.requesterEmail === "string"
  );
};

export const isRoleRequestMutationApiResponse = (
  value: unknown
): value is RoleRequestMutationApiResponse => {
  return Boolean(
    value &&
      typeof value === "object" &&
      "request" in value &&
      isRoleRequestApiItem((value as { request?: unknown }).request)
  );
};

export const isRoleRequestRealtimeApiEvent = (
  value: unknown
): value is RoleRequestRealtimeApiEvent => {
  return Boolean(value && typeof value === "object");
};

export const normalizeRoleRequestStatus = (
  status?: string | null
): RoleRequestStatusValue => {
  const normalizedStatus =
    typeof status === "string" ? status.trim().toUpperCase() : "";

  return availableStatuses.includes(normalizedStatus as RoleRequestStatusValue)
    ? (normalizedStatus as RoleRequestStatusValue)
    : "PENDING";
};

export const normalizeRoleRequest = (
  roleRequest: RoleRequestApiItem
): RoleRequestItem => ({
  id: roleRequest.id,
  requesterUserId: roleRequest.requesterUserId,
  requesterEmail: roleRequest.requesterEmail,
  requesterDisplayName:
    typeof roleRequest.requesterDisplayName === "string" &&
    roleRequest.requesterDisplayName.trim()
      ? roleRequest.requesterDisplayName.trim()
      : roleRequest.requesterEmail,
  currentRole: normalizeRole(roleRequest.currentRole),
  requestedRole: normalizeRole(roleRequest.requestedRole),
  description:
    typeof roleRequest.description === "string"
      ? roleRequest.description.trim()
      : "",
  status: normalizeRoleRequestStatus(roleRequest.status),
  rejectionReason:
    typeof roleRequest.rejectionReason === "string"
      ? roleRequest.rejectionReason.trim()
      : "",
  createdAt: roleRequest.createdAt ?? null,
  updatedAt: roleRequest.updatedAt ?? null,
  reviewedAt: roleRequest.reviewedAt ?? null,
});

export const normalizeRoleRequestEventType = (
  eventType?: string | null
): RoleRequestEventTypeValue => {
  const normalizedEventType =
    typeof eventType === "string" ? eventType.trim().toUpperCase() : "";

  return availableEventTypes.includes(
    normalizedEventType as RoleRequestEventTypeValue
  )
    ? (normalizedEventType as RoleRequestEventTypeValue)
    : "UPDATED";
};

export const normalizeRoleRequestRealtimeEvent = (
  event: RoleRequestRealtimeApiEvent
): RoleRequestRealtimeEvent => {
  const normalizedRequest = event.request
    ? normalizeRoleRequest(event.request)
    : null;

  return {
    eventType: normalizeRoleRequestEventType(event.eventType),
    message: typeof event.message === "string" ? event.message.trim() : "",
    actorUserId:
      typeof event.actorUserId === "string" && event.actorUserId.trim()
        ? event.actorUserId.trim()
        : null,
    requestId:
      typeof event.requestId === "string" && event.requestId.trim()
        ? event.requestId.trim()
        : normalizedRequest?.id ?? "",
    request: normalizedRequest,
    user:
      event.user &&
      typeof event.user === "object" &&
      typeof event.user.id === "string"
        ? {
            id: event.user.id,
            role: normalizeRole(event.user.role),
          }
        : null,
  };
};

const getComparableTimestamp = (value?: string | null) => {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const parsedValue = Date.parse(value);
  return Number.isNaN(parsedValue) ? Number.NEGATIVE_INFINITY : parsedValue;
};

export const sortRoleRequestsByNewest = (requests: RoleRequestItem[]) =>
  [...requests].sort(
    (leftRequest, rightRequest) =>
      getComparableTimestamp(rightRequest.createdAt) -
      getComparableTimestamp(leftRequest.createdAt)
  );

export const sortAdminRoleRequests = (requests: RoleRequestItem[]) =>
  [...requests].sort((leftRequest, rightRequest) => {
    if (leftRequest.status === "PENDING" && rightRequest.status !== "PENDING") {
      return -1;
    }

    if (leftRequest.status !== "PENDING" && rightRequest.status === "PENDING") {
      return 1;
    }

    return (
      getComparableTimestamp(rightRequest.createdAt) -
      getComparableTimestamp(leftRequest.createdAt)
    );
  });

export const upsertRoleRequest = (
  requests: RoleRequestItem[],
  request: RoleRequestItem,
  sorter: (items: RoleRequestItem[]) => RoleRequestItem[]
) => {
  const hasExistingRequest = requests.some(
    (currentRequest) => currentRequest.id === request.id
  );
  const nextRequests = hasExistingRequest
    ? requests.map((currentRequest) =>
        currentRequest.id === request.id ? request : currentRequest
      )
    : [request, ...requests];

  return sorter(nextRequests);
};

export const getRoleRequestStatusColor = (status: RoleRequestStatusValue) => {
  switch (status) {
    case "APPROVED":
      return "success" as const;
    case "REJECTED":
      return "error" as const;
    case "PENDING":
      return "warning" as const;
    default:
      return "info" as const;
  }
};

export const formatRoleRequestStatus = (status: RoleRequestStatusValue) =>
  formatRoleLabel(status);

export const getRequestedRoleBadgeColor = (role: UserRoleValue) =>
  getRoleBadgeColor(role);
