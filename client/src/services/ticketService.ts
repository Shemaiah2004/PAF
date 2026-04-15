import api, { ApiError } from "./api";
import { mockTicketService } from "./mockTicketService";
import type {
  ApiResponse,
  CreateCommentPayload,
  CreateTicketPayload,
  CurrentUser,
  Notification,
  Ticket,
  TicketComment,
  TicketAnalytics,
  TicketSummary,
  UpdateStatusPayload,
  UpdateTicketPayload,
  UserSummary,
} from "../types/ticket";

const DEMO_MODE_KEY = "paf_demo_mode";

const shouldUseMockFallback = (error: unknown) => {
  return error instanceof TypeError;
};

const withFallback = async <T>(request: () => Promise<T>, fallback: () => Promise<T>) => {
  try {
    const result = await request();
    localStorage.removeItem(DEMO_MODE_KEY);
    return result;
  } catch (error) {
    if (!shouldUseMockFallback(error)) {
      throw error;
    }
    localStorage.setItem(DEMO_MODE_KEY, "true");
    return fallback();
  }
};

export const isTicketApiOfflineError = (error: unknown) =>
  error instanceof TypeError;

export const getTicketApiErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Your session has expired. Please sign in again.";
    }

    if (error.status === 403) {
      return "You do not have permission to access maintenance tickets.";
    }

    return error.message;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Unable to load tickets. Check your server connection and try again.";
};

export const isDemoModeEnabled = () =>
  localStorage.getItem(DEMO_MODE_KEY) === "true";

export const ticketService = {
  async getCurrentUser() {
    return withFallback(
      async () => {
        const response = await api.get<ApiResponse<CurrentUser>>("/users/me");
        return response.data.data;
      },
      () => mockTicketService.getCurrentUser()
    );
  },

  async getTickets() {
    return withFallback(
      async () => {
        const response = await api.get<ApiResponse<Ticket[]>>("/tickets");
        return response.data.data;
      },
      () => mockTicketService.getTickets()
    );
  },

  async getTicket(ticketId: string) {
    return withFallback(
      async () => {
        const response = await api.get<ApiResponse<Ticket>>(`/tickets/${ticketId}`);
        return response.data.data;
      },
      () => mockTicketService.getTicket(ticketId)
    );
  },

  async createTicket(payload: CreateTicketPayload) {
    return withFallback(
      async () => {
        const formData = new FormData();
        formData.append(
          "ticket",
          new Blob(
            [
              JSON.stringify({
                title: payload.title,
                type: payload.type,
                category: payload.category,
                subcategory: payload.subcategory,
                description: payload.description,
                priority: payload.priority,
                severity: payload.severity,
                location: payload.location,
                building: payload.building,
                department: payload.department,
                preferredContactDetails: payload.preferredContactDetails,
              }),
            ],
            { type: "application/json" }
          )
        );

        payload.files.forEach((file) => {
          formData.append("files", file);
        });

        const response = await api.post<ApiResponse<Ticket>>("/tickets", formData);
        return response.data.data;
      },
      () => mockTicketService.createTicket(payload)
    );
  },

  async updateTicketStatus(ticketId: number, payload: UpdateStatusPayload) {
    return withFallback(
      async () => {
        const response = await api.put<ApiResponse<Ticket>>(
          `/tickets/${ticketId}/status`,
          payload
        );
        return response.data.data;
      },
      () => mockTicketService.updateTicketStatus(ticketId, payload)
    );
  },

  async updateTicket(ticketId: number, payload: UpdateTicketPayload) {
    return withFallback(
      async () => {
        const response = await api.put<ApiResponse<Ticket>>(`/tickets/${ticketId}`, payload);
        return response.data.data;
      },
      async () => {
        const existing = await mockTicketService.getTicket(String(ticketId));
        return {
          ...existing,
          ...payload,
        };
      }
    );
  },

  async assignTechnician(ticketId: number, technicianId: number) {
    return withFallback(
      async () => {
        const response = await api.put<ApiResponse<Ticket>>(
          `/tickets/${ticketId}/assign`,
          { technicianId }
        );
        return response.data.data;
      },
      () => mockTicketService.assignTechnician(ticketId, technicianId)
    );
  },

  async addComment(ticketId: number, payload: string | CreateCommentPayload) {
    const commentPayload =
      typeof payload === "string" ? { message: payload } : payload;

    return withFallback(
      async () => {
        const response = await api.post<ApiResponse<TicketComment>>(
          `/tickets/${ticketId}/comments`,
          commentPayload
        );
        return response.data.data;
      },
      () => mockTicketService.addComment(ticketId, commentPayload.message)
    );
  },

  async updateComment(commentId: number, message: string) {
    return withFallback(
      async () => {
        const response = await api.put<ApiResponse<TicketComment>>(
          `/comments/${commentId}`,
          { message }
        );
        return response.data.data;
      },
      () => mockTicketService.updateComment(commentId, message)
    );
  },

  async deleteComment(commentId: number) {
    return withFallback(
      async () => {
        await api.delete(`/comments/${commentId}`);
      },
      () => mockTicketService.deleteComment(commentId)
    );
  },

  async getTechnicians() {
    return withFallback(
      async () => {
        const response = await api.get<ApiResponse<UserSummary[]>>(
          "/users/technicians"
        );
        return response.data.data;
      },
      () => mockTicketService.getTechnicians()
    );
  },

  async getNotifications() {
    return withFallback(
      async () => {
        const response = await api.get<ApiResponse<Notification[]>>(
          "/notifications"
        );
        return response.data.data;
      },
      () => mockTicketService.getNotifications()
    );
  },

  async getSummary() {
    return withFallback(
      async () => {
        const response = await api.get<ApiResponse<TicketSummary>>("/tickets/summary");
        return response.data.data;
      },
      async () => {
        const tickets = await mockTicketService.getTickets();
        return {
          total: tickets.length,
          open: tickets.filter((ticket) => ticket.status === "OPEN").length,
          assigned: 0,
          inProgress: tickets.filter((ticket) => ticket.status === "IN_PROGRESS").length,
          overdue: 0,
          resolved: tickets.filter((ticket) => ticket.status === "RESOLVED").length,
          closed: tickets.filter((ticket) => ticket.status === "CLOSED").length,
        };
      }
    );
  },

  async getAnalytics() {
    return withFallback(
      async () => {
        const response = await api.get<ApiResponse<TicketAnalytics>>("/tickets/analytics");
        return response.data.data;
      },
      async () => ({
        monthlyCounts: {},
        typeBreakdown: {},
        categoryBreakdown: {},
        priorityBreakdown: {},
        statusBreakdown: {},
        averageResolutionHours: 0,
        overdueCount: 0,
        technicianWorkload: {},
      })
    );
  },

  async archiveTicket(ticketId: number) {
    return withFallback(
      async () => {
        const response = await api.delete<ApiResponse<Ticket>>(`/tickets/${ticketId}`);
        return response.data.data;
      },
      () => mockTicketService.getTicket(String(ticketId))
    );
  },
};
