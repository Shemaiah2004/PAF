import { Link } from "react-router";
import { useEffect, useMemo, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import TicketCard from "../../components/tickets/TicketCard";
import Input from "../../components/form/input/InputField";
import type { CurrentUser, Ticket, TicketStatus } from "../../types/ticket";
import { isDemoModeEnabled, ticketService } from "../../services/ticketService";

const statusOptions: Array<TicketStatus | "ALL"> = [
  "ALL",
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
  "REJECTED",
];

export default function TicketList() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "ALL">("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [user, ticketList] = await Promise.all([
          ticketService.getCurrentUser(),
          ticketService.getTickets(),
        ]);
        setCurrentUser(user);
        setTickets(ticketList);
        setDemoMode(isDemoModeEnabled());
      } catch (loadError) {
        setError("Unable to load tickets. Check your API credentials and server.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      const matchesSearch =
        ticket.title.toLowerCase().includes(search.toLowerCase()) ||
        ticket.category.toLowerCase().includes(search.toLowerCase()) ||
        ticket.description.toLowerCase().includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === "ALL" || ticket.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [search, statusFilter, tickets]);

  return (
    <div>
      <PageMeta
        title="Maintenance Tickets"
        description="Role-aware maintenance and incident ticket workspace"
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
            </div>
            <Link
              to="/tickets/new"
              className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-5 py-3.5 text-sm font-medium text-white transition hover:bg-brand-600"
            >
              Create ticket
            </Link>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-[2fr_1fr]">
            <Input
              placeholder="Search by title, category, or issue details"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as TicketStatus | "ALL")
              }
              className="h-11 rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            >
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "ALL" ? "All statuses" : option.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
        </div>

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
            Backend API is not running on <span className="font-semibold">localhost:8081</span>, so the page is using local demo data.
          </div>
        )}

        {!loading && !error && filteredTickets.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-white/[0.03] dark:text-gray-400">
            No tickets match the current filters.
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-2">
          {filteredTickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      </div>
    </div>
  );
}
