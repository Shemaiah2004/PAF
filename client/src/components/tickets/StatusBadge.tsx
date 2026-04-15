import Badge from "../ui/badge/Badge";
import type { TicketStatus } from "../../types/ticket";

const statusColors: Record<
  TicketStatus,
  "primary" | "warning" | "success" | "dark" | "error"
> = {
  OPEN: "primary",
  ASSIGNED: "primary",
  IN_PROGRESS: "warning",
  ON_HOLD: "warning",
  RESOLVED: "success",
  REOPENED: "warning",
  CLOSED: "dark",
  REJECTED: "error",
};

interface StatusBadgeProps {
  status: TicketStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <Badge color={statusColors[status]} size="sm">
      {status.replace("_", " ")}
    </Badge>
  );
}
