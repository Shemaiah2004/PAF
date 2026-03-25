import { formatRoleLabel } from "./auth";
import { getRoleBadgeColor, normalizeRole, type UserRoleValue } from "./userRoles";

export type RoleRequestStatusValue = "PENDING" | "APPROVED";

export type RoleRequestApiItem = {
  id: string;
  requesterUserId: string;
  requesterEmail: string;
  requesterDisplayName?: string | null;
  currentRole?: string | null;
  requestedRole?: string | null;
  description?: string | null;
  status?: string | null;
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

const availableStatuses: RoleRequestStatusValue[] = ["PENDING", "APPROVED"];

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
  createdAt: roleRequest.createdAt ?? null,
  updatedAt: roleRequest.updatedAt ?? null,
  reviewedAt: roleRequest.reviewedAt ?? null,
});

export const getRoleRequestStatusColor = (status: RoleRequestStatusValue) => {
  switch (status) {
    case "APPROVED":
      return "success" as const;
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
