export type UserRoleValue = "USER" | "TECHNICIAN" | "MANAGER" | "ADMIN";

export const availableRoles: UserRoleValue[] = [
  "USER",
  "TECHNICIAN",
  "MANAGER",
  "ADMIN",
];

export const roleDescriptions: Record<UserRoleValue, string> = {
  USER: "Default application access for signed-in users.",
  TECHNICIAN: "Operational access for technical and support work.",
  MANAGER: "Management access for coordination and oversight.",
  ADMIN: "Full administrative access to protected features.",
};

const roleRank: Record<UserRoleValue, number> = {
  USER: 0,
  TECHNICIAN: 1,
  MANAGER: 2,
  ADMIN: 3,
};

export const normalizeRole = (role?: string | null): UserRoleValue => {
  const normalizedRole =
    typeof role === "string" ? role.trim().toUpperCase() : "";

  return availableRoles.includes(normalizedRole as UserRoleValue)
    ? (normalizedRole as UserRoleValue)
    : "USER";
};

export const getRequestableRoles = (role?: string | null) => {
  const currentRole = normalizeRole(role);

  return availableRoles.filter(
    (roleOption) => roleRank[roleOption] > roleRank[currentRole]
  );
};

export const getRoleBadgeColor = (role: UserRoleValue) => {
  switch (role) {
    case "ADMIN":
      return "dark" as const;
    case "MANAGER":
      return "warning" as const;
    case "TECHNICIAN":
      return "success" as const;
    case "USER":
      return "primary" as const;
    default:
      return "info" as const;
  }
};

export const formatTimestamp = (value?: string | null) => {
  if (!value) {
    return "Unavailable";
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return "Unavailable";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsedDate);
};

export const getUserInitials = (displayName: string, email: string) => {
  const source = displayName.trim() || email.trim();
  const words = source.split(/[\s@._-]+/).filter(Boolean);

  if (words.length === 0) {
    return "U";
  }

  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
};
