import api from "./api";
import { mockTicketService } from "./mockTicketService";
import type {
  ApiResponse,
  CreateTicketPayload,
  CurrentUser,
  Notification,
  Ticket,
  TicketComment,
  UpdateStatusPayload,
  UserSummary,
} from "../types/ticket";

const DEMO_MODE_KEY = "paf_demo_mode";

const shouldUseMockFallback = (error: unknown) => {
  return error instanceof TypeError || error instanceof Error;
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
                category: payload.category,
                description: payload.description,
                priority: payload.priority,
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

  async addComment(ticketId: number, message: string) {
    return withFallback(
      async () => {
        const response = await api.post<ApiResponse<TicketComment>>(
          `/tickets/${ticketId}/comments`,
          { message }
        );
        return response.data.data;
      },
      () => mockTicketService.addComment(ticketId, message)
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
};
