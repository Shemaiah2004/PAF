import { Link } from "react-router";
import { useEffect, useMemo, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import TicketCard from "../../components/tickets/TicketCard";
import Input from "../../components/form/input/InputField";
import type {
  CurrentUser,
  Ticket,
  TicketAnalytics,
  TicketPriority,
  TicketStatus,
  TicketSummary,
  TicketType,
} from "../../types/ticket";
import {
  getTicketApiErrorMessage,
  isDemoModeEnabled,
  isTicketApiOfflineError,
  ticketService,
} from "../../services/ticketService";

const statusOptions: Array<TicketStatus | "ALL"> = [
  "ALL",
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "ON_HOLD",
  "RESOLVED",
  "REOPENED",
  "CLOSED",
  "REJECTED",
];

const typeOptions: Array<TicketType | "ALL"> = ["ALL", "MAINTENANCE", "INCIDENT"];
const priorityOptions: Array<TicketPriority | "ALL"> = ["ALL", "LOW", "MEDIUM", "HIGH"];
const pageSize = 6;

const summaryCards = (summary: TicketSummary | null) => [
  { label: "Total", value: summary?.total ?? 0 },
  { label: "Open", value: summary?.open ?? 0 },
  { label: "Assigned", value: summary?.assigned ?? 0 },
  { label: "In Progress", value: summary?.inProgress ?? 0 },
  { label: "Overdue", value: summary?.overdue ?? 0 },
  { label: "Resolved", value: summary?.resolved ?? 0 },
];

export default function TicketList() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [summary, setSummary] = useState<TicketSummary | null>(null);
  const [analytics, setAnalytics] = useState<TicketAnalytics | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "ALL">("ALL");
  const [typeFilter, setTypeFilter] = useState<TicketType | "ALL">("ALL");
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | "ALL">("ALL");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "priority">("newest");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const [user, ticketList, ticketSummary, ticketAnalytics] = await Promise.all([
          ticketService.getCurrentUser(),
          ticketService.getTickets(),
          ticketService.getSummary(),
          ticketService.getAnalytics(),
        ]);
        setCurrentUser(user);
        setTickets(ticketList);
        setSummary(ticketSummary);
        setAnalytics(ticketAnalytics);
        setDemoMode(isDemoModeEnabled());
      } catch (loadError) {
        setDemoMode(isTicketApiOfflineError(loadError) && isDemoModeEnabled());
        setError(getTicketApiErrorMessage(loadError));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const filteredTickets = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const filtered = tickets.filter((ticket) => {
      const matchesSearch =
        !normalizedSearch ||
        ticket.ticketNumber.toLowerCase().includes(normalizedSearch) ||
        ticket.title.toLowerCase().includes(normalizedSearch) ||
        ticket.category.toLowerCase().includes(normalizedSearch) ||
        (ticket.subcategory ?? "").toLowerCase().includes(normalizedSearch) ||
        ticket.description.toLowerCase().includes(normalizedSearch) ||
        (ticket.assignedTechnician?.fullName ?? "").toLowerCase().includes(normalizedSearch);
      const matchesStatus =
        statusFilter === "ALL" || ticket.status === statusFilter;
      const matchesType = typeFilter === "ALL" || ticket.type === typeFilter;
      const matchesPriority =
        priorityFilter === "ALL" || ticket.priority === priorityFilter;
      const matchesAssignee =
        !assigneeFilter.trim() ||
        (ticket.assignedTechnician?.fullName ?? "")
          .toLowerCase()
          .includes(assigneeFilter.trim().toLowerCase());

      return matchesSearch && matchesStatus && matchesType && matchesPriority && matchesAssignee;
    });

    filtered.sort((left, right) => {
      if (sortBy === "oldest") {
        return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
      }
      if (sortBy === "priority") {
        const order = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        return order[right.priority] - order[left.priority];
      }
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });

    return filtered;
  }, [assigneeFilter, priorityFilter, search, sortBy, statusFilter, tickets, typeFilter]);

  const pagedTickets = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTickets.slice(start, start + pageSize);
  }, [filteredTickets, page]);

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, typeFilter, priorityFilter, assigneeFilter, sortBy]);

  const analyticsEntries = (values: Record<string, number> | undefined) =>
    Object.entries(values ?? {}).slice(0, 5);

  return (
    <div>
      <PageMeta
        title="Maintenance Tickets"
        description="Integrated maintenance and incident ticket workspace"
      />
      <PageBreadcrumb pageTitle="Maintenance Tickets" />

      <div className="space-y-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium text-brand-500">
                {currentUser ? `Signed in as ${currentUser.role}` : "Loading profile"}
              </p>
              <h3 className="mt-1 text-2xl font-semibold text-gray-800 dark:text-white/90">
                Track incidents from report to closure
              </h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Search, classify, assign, and monitor maintenance work with live backend data.
              </p>
            </div>
            <Link
              to="/tickets/new"
              className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-5 py-3.5 text-sm font-medium text-white transition hover:bg-brand-600"
            >
              Create ticket
            </Link>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Input
              placeholder="Search by ID, title, category, or assignee"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as TicketStatus | "ALL")}
              className="h-11 rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            >
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "ALL" ? "All statuses" : option.replace("_", " ")}
                </option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as TicketType | "ALL")}
              className="h-11 rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            >
              {typeOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "ALL" ? "All types" : option}
                </option>
              ))}
            </select>
            <Input
              placeholder="Filter by assignee"
              value={assigneeFilter}
              onChange={(event) => setAssigneeFilter(event.target.value)}
            />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <select
              value={priorityFilter}
              onChange={(event) =>
                setPriorityFilter(event.target.value as TicketPriority | "ALL")
              }
              className="h-11 rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            >
              {priorityOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "ALL" ? "All priorities" : option}
                </option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(event) =>
                setSortBy(event.target.value as "newest" | "oldest" | "priority")
              }
              className="h-11 rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            >
              <option value="newest">Sort by newest</option>
              <option value="oldest">Sort by oldest</option>
              <option value="priority">Sort by priority</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {summaryCards(summary).map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]"
            >
              <p className="text-sm text-gray-500 dark:text-gray-400">{card.label}</p>
              <p className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
                {card.value}
              </p>
            </div>
          ))}
        </div>

        {(analyticsEntries(analytics?.statusBreakdown).length > 0 ||
          analyticsEntries(analytics?.categoryBreakdown).length > 0) && (
          <div className="grid gap-6 xl:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <h4 className="text-sm font-semibold text-gray-800 dark:text-white/90">
                Status breakdown
              </h4>
              <div className="mt-4 space-y-3 text-sm">
                {analyticsEntries(analytics?.statusBreakdown).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-gray-500 dark:text-gray-400">
                      {key.replace(/_/g, " ")}
                    </span>
                    <span className="font-medium text-gray-800 dark:text-white/90">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <h4 className="text-sm font-semibold text-gray-800 dark:text-white/90">
                Category breakdown
              </h4>
              <div className="mt-4 space-y-3 text-sm">
                {analyticsEntries(analytics?.categoryBreakdown).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-gray-500 dark:text-gray-400">{key}</span>
                    <span className="font-medium text-gray-800 dark:text-white/90">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <h4 className="text-sm font-semibold text-gray-800 dark:text-white/90">
                Resolution insights
              </h4>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Average resolution</span>
                  <span className="font-medium text-gray-800 dark:text-white/90">
                    {analytics?.averageResolutionHours?.toFixed(1) ?? "0.0"} hrs
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Overdue tickets</span>
                  <span className="font-medium text-gray-800 dark:text-white/90">
                    {analytics?.overdueCount ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Technicians loaded</span>
                  <span className="font-medium text-gray-800 dark:text-white/90">
                    {Object.keys(analytics?.technicianWorkload ?? {}).length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400">
            Loading tickets...
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-error-200 bg-error-50 p-6 text-sm text-error-600">
            {error}
          </div>
        )}

        {demoMode && !error && (
          <div className="rounded-2xl border border-warning-200 bg-warning-50 p-6 text-sm text-warning-700">
            Backend API is not running on <span className="font-semibold">localhost:8080</span>, so the page is using local demo data.
          </div>
        )}

        {!loading && !error && filteredTickets.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-white/[0.03] dark:text-gray-400">
            No tickets match the current filters.
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-2">
          {pagedTickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </div>

        {filteredTickets.length > pageSize && (
          <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-5 py-4 text-sm dark:border-gray-800 dark:bg-white/[0.03]">
            <span className="text-gray-500 dark:text-gray-400">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
                className="rounded-lg border border-gray-300 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-gray-300 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
