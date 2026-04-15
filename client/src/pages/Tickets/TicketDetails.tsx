import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import TextArea from "../../components/form/input/TextArea";
import Button from "../../components/ui/button/Button";
import StatusBadge from "../../components/tickets/StatusBadge";
import CommentSection from "../../components/tickets/CommentSection";
import { API_ORIGIN } from "../../services/api";
import { getTicketApiErrorMessage, ticketService } from "../../services/ticketService";
import type {
  CurrentUser,
  Ticket,
  TicketPriority,
  TicketSeverity,
  TicketStatus,
  TicketType,
  UserSummary,
} from "../../types/ticket";

type EditFormState = {
  title: string;
  type: TicketType;
  category: string;
  subcategory: string;
  description: string;
  priority: TicketPriority;
  severity: TicketSeverity;
  location: string;
  building: string;
  department: string;
  preferredContactDetails: string;
};

const buildEditState = (ticket: Ticket): EditFormState => ({
  title: ticket.title,
  type: ticket.type,
  category: ticket.category,
  subcategory: ticket.subcategory ?? "",
  description: ticket.description,
  priority: ticket.priority,
  severity: ticket.severity,
  location: ticket.location ?? "",
  building: ticket.building ?? "",
  department: ticket.department ?? "",
  preferredContactDetails: ticket.preferredContactDetails,
});

const statusOptions: TicketStatus[] = [
  "ASSIGNED",
  "IN_PROGRESS",
  "ON_HOLD",
  "RESOLVED",
  "REOPENED",
  "CLOSED",
  "REJECTED",
];

export default function TicketDetails() {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [technicians, setTechnicians] = useState<UserSummary[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<TicketStatus | "">("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [selectedTechnician, setSelectedTechnician] = useState("");
  const [editing, setEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [archiving, setArchiving] = useState(false);
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
      setEditForm(buildEditState(detail));
      setTechnicians(techList);
      setSelectedTechnician(detail.assignedTechnician?.id.toString() ?? "");
    } catch (loadError) {
      setError(getTicketApiErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [ticketId]);

  const canAssign = currentUser?.role === "ADMIN";
  const canEdit = useMemo(() => {
    if (!ticket || !currentUser) {
      return false;
    }
    if (currentUser.role === "ADMIN") {
      return true;
    }
    return (
      currentUser.id === ticket.createdBy.id &&
      ["OPEN", "ASSIGNED", "ON_HOLD", "REOPENED"].includes(ticket.status)
    );
  }, [currentUser, ticket]);

  const canUpdateStatus = useMemo(() => {
    if (!ticket || !currentUser) {
      return false;
    }
    return (
      currentUser.role === "ADMIN" ||
      (currentUser.role === "TECHNICIAN" &&
        currentUser.id === ticket.assignedTechnician?.id) ||
      (currentUser.role === "USER" &&
        currentUser.id === ticket.createdBy.id &&
        ["RESOLVED", "CLOSED"].includes(ticket.status))
    );
  }, [currentUser, ticket]);

  const saveTicketChanges = async () => {
    if (!ticket || !editForm) {
      return;
    }
    try {
      setSavingEdit(true);
      setError("");
      const updated = await ticketService.updateTicket(ticket.id, editForm);
      setTicket(updated);
      setEditForm(buildEditState(updated));
      setEditing(false);
    } catch (updateError) {
      setError(getTicketApiErrorMessage(updateError));
    } finally {
      setSavingEdit(false);
    }
  };

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
    } catch (updateError) {
      setError(getTicketApiErrorMessage(updateError));
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
    } catch (assignError) {
      setError(getTicketApiErrorMessage(assignError));
    }
  };

  const archiveTicket = async () => {
    if (!ticket) {
      return;
    }
    try {
      setArchiving(true);
      const archivedTicket = await ticketService.archiveTicket(ticket.id);
      setTicket(archivedTicket);
      navigate("/tickets");
    } catch (archiveError) {
      setError(getTicketApiErrorMessage(archiveError));
    } finally {
      setArchiving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-gray-500">Loading ticket...</div>;
  }

  if (!ticket || !currentUser || !editForm) {
    return (
      <div className="rounded-2xl border border-error-200 bg-error-50 p-6 text-sm text-error-600">
        {error || "Ticket not found."}
      </div>
    );
  }

  return (
    <div>
      <PageMeta
        title={`${ticket.ticketNumber} - ${ticket.title}`}
        description="Maintenance ticket detail view"
      />
      <PageBreadcrumb pageTitle={ticket.ticketNumber} />

      <div className="space-y-6">
        {error && (
          <div className="rounded-2xl border border-error-200 bg-error-50 p-4 text-sm text-error-600">
            {error}
          </div>
        )}

        <ComponentCard
          title={`${ticket.ticketNumber} - ${ticket.title}`}
          desc={`${ticket.type} - ${ticket.category}${ticket.subcategory ? ` / ${ticket.subcategory}` : ""} - Submitted by ${ticket.createdBy.fullName}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={ticket.status} />
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                Priority {ticket.priority} / {ticket.severity}
              </span>
              <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-600">
                {ticket.type}
              </span>
            </div>
            <div className="flex gap-2">
              {canEdit && (
                <Button variant="outline" onClick={() => setEditing((current) => !current)}>
                  {editing ? "Cancel edit" : "Edit ticket"}
                </Button>
              )}
              <Button variant="outline" onClick={archiveTicket} disabled={archiving}>
                {archiving ? "Archiving..." : "Archive"}
              </Button>
            </div>
          </div>

          {editing ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={editForm.title}
                  onChange={(event) =>
                    setEditForm((current) =>
                      current ? { ...current, title: event.target.value } : current
                    )
                  }
                />
              </div>
              <div>
                <Label htmlFor="edit-type">Type</Label>
                <select
                  id="edit-type"
                  value={editForm.type}
                  onChange={(event) =>
                    setEditForm((current) =>
                      current
                        ? { ...current, type: event.target.value as TicketType }
                        : current
                    )
                  }
                  className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                >
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="INCIDENT">Incident</option>
                </select>
              </div>
              <div>
                <Label htmlFor="edit-category">Category</Label>
                <Input
                  id="edit-category"
                  value={editForm.category}
                  onChange={(event) =>
                    setEditForm((current) =>
                      current ? { ...current, category: event.target.value } : current
                    )
                  }
                />
              </div>
              <div>
                <Label htmlFor="edit-subcategory">Subcategory</Label>
                <Input
                  id="edit-subcategory"
                  value={editForm.subcategory}
                  onChange={(event) =>
                    setEditForm((current) =>
                      current ? { ...current, subcategory: event.target.value } : current
                    )
                  }
                />
              </div>
              <div>
                <Label htmlFor="edit-priority">Priority</Label>
                <select
                  id="edit-priority"
                  value={editForm.priority}
                  onChange={(event) =>
                    setEditForm((current) =>
                      current
                        ? { ...current, priority: event.target.value as TicketPriority }
                        : current
                    )
                  }
                  className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </div>
              <div>
                <Label htmlFor="edit-severity">Severity</Label>
                <select
                  id="edit-severity"
                  value={editForm.severity}
                  onChange={(event) =>
                    setEditForm((current) =>
                      current
                        ? { ...current, severity: event.target.value as TicketSeverity }
                        : current
                    )
                  }
                  className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
              <div>
                <Label htmlFor="edit-location">Location</Label>
                <Input
                  id="edit-location"
                  value={editForm.location}
                  onChange={(event) =>
                    setEditForm((current) =>
                      current ? { ...current, location: event.target.value } : current
                    )
                  }
                />
              </div>
              <div>
                <Label htmlFor="edit-building">Building</Label>
                <Input
                  id="edit-building"
                  value={editForm.building}
                  onChange={(event) =>
                    setEditForm((current) =>
                      current ? { ...current, building: event.target.value } : current
                    )
                  }
                />
              </div>
              <div>
                <Label htmlFor="edit-department">Department</Label>
                <Input
                  id="edit-department"
                  value={editForm.department}
                  onChange={(event) =>
                    setEditForm((current) =>
                      current ? { ...current, department: event.target.value } : current
                    )
                  }
                />
              </div>
              <div>
                <Label htmlFor="edit-contact">Preferred Contact</Label>
                <Input
                  id="edit-contact"
                  value={editForm.preferredContactDetails}
                  onChange={(event) =>
                    setEditForm((current) =>
                      current
                        ? { ...current, preferredContactDetails: event.target.value }
                        : current
                    )
                  }
                />
              </div>
              <div className="lg:col-span-2">
                <Label>Description</Label>
                <TextArea
                  rows={5}
                  value={editForm.description}
                  onChange={(value) =>
                    setEditForm((current) =>
                      current ? { ...current, description: value } : current
                    )
                  }
                />
              </div>
              <div className="lg:col-span-2 flex justify-end">
                <Button onClick={saveTicketChanges} disabled={savingEdit}>
                  {savingEdit ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </div>
          ) : (
            <>
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
                    Location
                  </p>
                  <p className="mt-2 text-sm text-gray-700 dark:text-white/90">
                    {[ticket.location, ticket.building, ticket.department]
                      .filter(Boolean)
                      .join(" / ") || "Not specified"}
                  </p>
                </div>
                <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/60">
                  <p className="text-xs uppercase tracking-wide text-gray-400">
                    Due
                  </p>
                  <p className="mt-2 text-sm text-gray-700 dark:text-white/90">
                    {ticket.dueAt ? new Date(ticket.dueAt).toLocaleString() : "No SLA"}
                  </p>
                </div>
              </div>
            </>
          )}

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
                    Preview attachment
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
            desc="Assign or reassign this ticket to the right technician."
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
                  {statusOptions.map((option) => (
                    <option key={option} value={option}>
                      {option.replace(/_/g, " ")}
                    </option>
                  ))}
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

            <div>
              <Label>Rejection Reason</Label>
              <TextArea
                rows={4}
                value={rejectionReason}
                onChange={setRejectionReason}
                placeholder="Required when rejecting a ticket"
              />
            </div>
          </ComponentCard>
        )}

        <ComponentCard
          title="Discussion"
          desc="Comments are visible to the ticket owner and staff. Staff can also add internal notes."
        >
          <CommentSection
            comments={ticket.comments}
            currentUser={currentUser}
            onAddComment={async (payload) => {
              await ticketService.addComment(ticket.id, payload);
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

        <ComponentCard
          title="Activity Timeline"
          desc="Status changes, assignments, comments, and other ticket actions."
        >
          <div className="space-y-4">
            {ticket.activity.map((entry) => (
              <div
                key={entry.id}
                className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-white/90">
                      {entry.message}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {entry.actor.fullName} - {entry.actor.role} - {new Date(entry.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {entry.internalOnly && (
                    <span className="rounded-full bg-warning-50 px-2.5 py-1 text-xs font-medium text-warning-700">
                      Internal
                    </span>
                  )}
                </div>
              </div>
            ))}

            {ticket.activity.length === 0 && (
              <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                No activity recorded yet.
              </div>
            )}
          </div>
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
