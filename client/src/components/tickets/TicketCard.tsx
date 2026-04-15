import { Link } from "react-router";
import ComponentCard from "../common/ComponentCard";
import StatusBadge from "./StatusBadge";
import type { Ticket } from "../../types/ticket";

interface TicketCardProps {
  ticket: Ticket;
}

const priorityStyles = {
  LOW: "text-gray-500",
  MEDIUM: "text-warning-500",
  HIGH: "text-error-500",
  CRITICAL: "text-error-600",
};

export default function TicketCard({ ticket }: TicketCardProps) {
  return (
    <ComponentCard
      title={`${ticket.ticketNumber} - ${ticket.title}`}
      desc={`${ticket.type} - ${ticket.category}${ticket.subcategory ? ` / ${ticket.subcategory}` : ""} - Created ${new Date(
        ticket.createdAt
      ).toLocaleString()}`}
      className="h-full"
    >
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm leading-6 text-gray-500 dark:text-gray-400">
          {ticket.description}
        </p>
        <StatusBadge status={ticket.status} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/60">
          <p className="text-xs uppercase tracking-wide text-gray-400">
            Priority
          </p>
          <p className={`mt-1 text-sm font-semibold ${priorityStyles[ticket.severity]}`}>
            {ticket.priority} / {ticket.severity}
          </p>
        </div>
        <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/60">
          <p className="text-xs uppercase tracking-wide text-gray-400">
            Assigned technician
          </p>
          <p className="mt-1 text-sm font-semibold text-gray-700 dark:text-white/90">
            {ticket.assignedTechnician?.fullName ?? "Unassigned"}
          </p>
        </div>
        <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/60">
          <p className="text-xs uppercase tracking-wide text-gray-400">
            Location
          </p>
          <p className="mt-1 text-sm font-semibold text-gray-700 dark:text-white/90">
            {ticket.location ?? ticket.building ?? ticket.department ?? "Not specified"}
          </p>
        </div>
        <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/60">
          <p className="text-xs uppercase tracking-wide text-gray-400">
            Due
          </p>
          <p className="mt-1 text-sm font-semibold text-gray-700 dark:text-white/90">
            {ticket.dueAt ? new Date(ticket.dueAt).toLocaleString() : "No SLA"}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {ticket.comments.length} comment{ticket.comments.length === 1 ? "" : "s"}
        </div>
        <Link
          to={`/tickets/${ticket.id}`}
          className="inline-flex items-center rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
        >
          View details
        </Link>
      </div>
    </ComponentCard>
  );
}
