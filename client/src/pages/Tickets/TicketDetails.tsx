import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";
import Label from "../../components/form/Label";
import TextArea from "../../components/form/input/TextArea";
import Button from "../../components/ui/button/Button";
import StatusBadge from "../../components/tickets/StatusBadge";
import CommentSection from "../../components/tickets/CommentSection";
import { API_ORIGIN } from "../../services/api";
import { ticketService } from "../../services/ticketService";
import type {
  CurrentUser,
  Ticket,
  TicketStatus,
  UserSummary,
} from "../../types/ticket";

export default function TicketDetails() {
  const { ticketId } = useParams();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [technicians, setTechnicians] = useState<UserSummary[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<TicketStatus | "">("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [selectedTechnician, setSelectedTechnician] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    if (!ticketId) {
      return;
    }
    try {
      setLoading(true);
      setError("");
      const [user, detail, techList] = await Promise.all([
        ticketService.getCurrentUser(),
        ticketService.getTicket(ticketId),
        ticketService.getTechnicians(),
      ]);
      setCurrentUser(user);
      setTicket(detail);
      setTechnicians(techList);
      setSelectedTechnician(detail.assignedTechnician?.id.toString() ?? "");
    } catch {
      setError("Unable to load this ticket. Check your credentials and server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [ticketId]);

  const submitStatusUpdate = async () => {
    if (!ticket || !selectedStatus) {
      return;
    }
    try {
      const updated = await ticketService.updateTicketStatus(ticket.id, {
        status: selectedStatus,
        resolutionNotes,
        rejectionReason,
      });
      setTicket(updated);
      setSelectedStatus("");
      setResolutionNotes("");
      setRejectionReason("");
    } catch {
      setError("Status update failed. Review the allowed workflow and try again.");
    }
  };

  const assignTechnician = async () => {
    if (!ticket || !selectedTechnician) {
      return;
    }
    try {
      const updated = await ticketService.assignTechnician(
        ticket.id,
        Number(selectedTechnician)
      );
      setTicket(updated);
    } catch {
      setError("Technician assignment failed.");
    }
  };

  if (loading) {
    return <div className="text-sm text-gray-500">Loading ticket...</div>;
  }

  if (!ticket || !currentUser) {
    return (
      <div className="rounded-2xl border border-error-200 bg-error-50 p-6 text-sm text-error-600">
        {error || "Ticket not found."}
      </div>
    );
  }

  const canAssign = currentUser.role === "ADMIN";
  const canUpdateStatus =
    currentUser.role === "ADMIN" ||
    (currentUser.role === "TECHNICIAN" &&
      currentUser.id === ticket.assignedTechnician?.id) ||
    (currentUser.role === "USER" &&
      currentUser.id === ticket.createdBy.id &&
      ticket.status === "RESOLVED");

  return (
    <div>
      <PageMeta
        title={`Ticket #${ticket.id}`}
        description="Maintenance ticket detail view"
      />
      <PageBreadcrumb pageTitle={`Ticket #${ticket.id}`} />

      <div className="space-y-6">
        {error && (
          <div className="rounded-2xl border border-error-200 bg-error-50 p-4 text-sm text-error-600">
            {error}
          </div>
        )}

        <ComponentCard
          title={ticket.title}
          desc={`${ticket.category} - Submitted by ${ticket.createdBy.fullName}`}
        >
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={ticket.status} />
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              Priority {ticket.priority}
            </span>
          </div>

          <p className="text-sm leading-7 text-gray-600 dark:text-gray-300">
            {ticket.description}
          </p>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/60">
              <p className="text-xs uppercase tracking-wide text-gray-400">
                Contact
              </p>
              <p className="mt-2 text-sm text-gray-700 dark:text-white/90">
                {ticket.preferredContactDetails}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/60">
              <p className="text-xs uppercase tracking-wide text-gray-400">
                Assigned
              </p>
              <p className="mt-2 text-sm text-gray-700 dark:text-white/90">
                {ticket.assignedTechnician?.fullName ?? "Pending assignment"}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/60">
              <p className="text-xs uppercase tracking-wide text-gray-400">
                Created
              </p>
              <p className="mt-2 text-sm text-gray-700 dark:text-white/90">
                {new Date(ticket.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/60">
              <p className="text-xs uppercase tracking-wide text-gray-400">
                Updated
              </p>
              <p className="mt-2 text-sm text-gray-700 dark:text-white/90">
                {new Date(ticket.updatedAt).toLocaleString()}
              </p>
            </div>
          </div>

          {ticket.attachments.length > 0 && (
            <div>
              <p className="mb-3 text-sm font-medium text-gray-700 dark:text-white/90">
                Attachments
              </p>
              <div className="flex flex-wrap gap-3">
                {ticket.attachments.map((attachment) => (
                  <a
                    key={attachment}
                    href={`${API_ORIGIN}${attachment}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-brand-500 transition hover:border-brand-300 dark:border-gray-700"
                  >
                    View image
                  </a>
                ))}
              </div>
            </div>
          )}

          {ticket.resolutionNotes && (
            <div className="rounded-2xl border border-success-200 bg-success-50 p-4">
              <p className="text-sm font-semibold text-success-700">
                Resolution notes
              </p>
              <p className="mt-2 text-sm text-success-700">
                {ticket.resolutionNotes}
              </p>
            </div>
          )}

          {ticket.rejectionReason && (
            <div className="rounded-2xl border border-error-200 bg-error-50 p-4">
              <p className="text-sm font-semibold text-error-700">
                Rejection reason
              </p>
              <p className="mt-2 text-sm text-error-700">
                {ticket.rejectionReason}
              </p>
            </div>
          )}
        </ComponentCard>

        {canAssign && (
          <ComponentCard
            title="Assignment"
            desc="Route this ticket to the right technician."
          >
            <div className="flex flex-col gap-4 md:flex-row">
              <select
                value={selectedTechnician}
                onChange={(event) => setSelectedTechnician(event.target.value)}
                className="h-11 flex-1 rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              >
                <option value="">Select technician</option>
                {technicians.map((technician) => (
                  <option key={technician.id} value={technician.id}>
                    {technician.fullName}
                  </option>
                ))}
              </select>
              <Button onClick={assignTechnician} disabled={!selectedTechnician}>
                Save assignment
              </Button>
            </div>
          </ComponentCard>
        )}

        {canUpdateStatus && (
          <ComponentCard
            title="Status Update"
            desc="Only valid workflow transitions will be accepted."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <Label htmlFor="status">Next status</Label>
                <select
                  id="status"
                  value={selectedStatus}
                  onChange={(event) =>
                    setSelectedStatus(event.target.value as TicketStatus | "")
                  }
                  className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                >
                  <option value="">Choose status</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="CLOSED">Closed</option>
                  {currentUser.role === "ADMIN" && (
                    <option value="REJECTED">Rejected</option>
                  )}
                </select>
              </div>
              <div className="flex items-end">
                <Button onClick={submitStatusUpdate} disabled={!selectedStatus}>
                  Apply status change
                </Button>
              </div>
            </div>

            <div>
              <Label>Resolution Notes</Label>
              <TextArea
                rows={4}
                value={resolutionNotes}
                onChange={setResolutionNotes}
                placeholder="Required when moving a ticket to resolved"
              />
            </div>

            {currentUser.role === "ADMIN" && (
              <div>
                <Label>Rejection Reason</Label>
                <TextArea
                  rows={4}
                  value={rejectionReason}
                  onChange={setRejectionReason}
                  placeholder="Required when rejecting a ticket"
                />
              </div>
            )}
          </ComponentCard>
        )}

        <ComponentCard
          title="Discussion"
          desc="Comments are visible to the ticket owner and staff."
        >
          <CommentSection
            comments={ticket.comments}
            currentUser={currentUser}
            onAddComment={async (message) => {
              await ticketService.addComment(ticket.id, message);
              await loadData();
            }}
            onUpdateComment={async (commentId, message) => {
              await ticketService.updateComment(commentId, message);
              await loadData();
            }}
            onDeleteComment={async (commentId) => {
              await ticketService.deleteComment(commentId);
              await loadData();
            }}
          />
        </ComponentCard>

        <div className="flex justify-end">
          <Link
            to="/tickets"
            className="text-sm font-medium text-brand-500 transition hover:text-brand-600"
          >
            Back to ticket list
          </Link>
        </div>
      </div>
    </div>
  );
}
