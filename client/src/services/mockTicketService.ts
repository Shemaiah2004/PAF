import type {
  CreateTicketPayload,
  CurrentUser,
  Notification,
  Ticket,
  TicketComment,
  UpdateStatusPayload,
  UserSummary,
} from "../types/ticket";

const STORAGE_KEYS = {
  tickets: "paf_mock_tickets",
  currentUser: "paf_mock_current_user",
  technicians: "paf_mock_technicians",
  notifications: "paf_mock_notifications",
};

const defaultUser: CurrentUser = {
  id: 1,
  fullName: "System Administrator",
  email: "admin@paf.local",
  role: "ADMIN",
};

const defaultTechnicians: UserSummary[] = [
  {
    id: 2,
    fullName: "Field Technician",
    email: "tech@paf.local",
    role: "TECHNICIAN",
  },
  {
    id: 3,
    fullName: "Electrical Specialist",
    email: "electric@paf.local",
    role: "TECHNICIAN",
  },
];

const now = new Date().toISOString();

const defaultTickets: Ticket[] = [
  {
    id: 1001,
    title: "Leak near generator room",
    category: "Plumbing",
    description:
      "Water is collecting near the generator room entrance and needs inspection before it becomes a safety hazard.",
    priority: "HIGH",
    status: "OPEN",
    preferredContactDetails: "admin@paf.local / Ext 101",
    resolutionNotes: null,
    rejectionReason: null,
    createdAt: now,
    updatedAt: now,
    createdBy: defaultUser,
    assignedTechnician: null,
    attachments: [],
    comments: [
      {
        id: 5001,
        message: "Reported during the morning facility walk-through.",
        author: defaultUser,
        timestamp: now,
        editable: true,
      },
    ],
  },
  {
    id: 1002,
    title: "AC cooling issue in meeting room",
    category: "HVAC",
    description:
      "Conference room AC is running but not cooling. Staff reported the issue during the afternoon session.",
    priority: "MEDIUM",
    status: "IN_PROGRESS",
    preferredContactDetails: "admin@paf.local / Ext 101",
    resolutionNotes: null,
    rejectionReason: null,
    createdAt: now,
    updatedAt: now,
    createdBy: defaultUser,
    assignedTechnician: defaultTechnicians[0],
    attachments: [],
    comments: [],
  },
];

const defaultNotifications: Notification[] = [
  {
    id: 9001,
    type: "STATUS_CHANGED",
    title: "Ticket status updated",
    message: "Ticket #1002 moved to In Progress.",
    read: false,
    ticketId: 1002,
    createdAt: now,
  },
];

const readFromStorage = <T>(key: string, fallback: T): T => {
  const value = localStorage.getItem(key);
  if (!value) {
    localStorage.setItem(key, JSON.stringify(fallback));
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    localStorage.setItem(key, JSON.stringify(fallback));
    return fallback;
  }
};

const writeToStorage = <T>(key: string, value: T) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const getTickets = () => readFromStorage(STORAGE_KEYS.tickets, defaultTickets);
const saveTickets = (tickets: Ticket[]) => writeToStorage(STORAGE_KEYS.tickets, tickets);

const getCurrentUser = () =>
  readFromStorage(STORAGE_KEYS.currentUser, defaultUser);

const getTechnicians = () =>
  readFromStorage(STORAGE_KEYS.technicians, defaultTechnicians);

const getNotifications = () =>
  readFromStorage(STORAGE_KEYS.notifications, defaultNotifications);

const nextId = (values: number[]) => (values.length ? Math.max(...values) + 1 : 1);

export const mockTicketService = {
  async getCurrentUser() {
    return getCurrentUser();
  },

  async getTickets() {
    return getTickets();
  },

  async getTicket(ticketId: string) {
    const ticket = getTickets().find((item) => item.id === Number(ticketId));
    if (!ticket) {
      throw new Error("Ticket not found");
    }
    return ticket;
  },

  async createTicket(payload: CreateTicketPayload) {
    const tickets = getTickets();
    const currentUser = getCurrentUser();
    const createdAt = new Date().toISOString();
    const newTicket: Ticket = {
      id: nextId(tickets.map((ticket) => ticket.id)),
      title: payload.title,
      category: payload.category,
      description: payload.description,
      priority: payload.priority,
      status: "OPEN",
      preferredContactDetails: payload.preferredContactDetails,
      resolutionNotes: null,
      rejectionReason: null,
      createdAt,
      updatedAt: createdAt,
      createdBy: currentUser,
      assignedTechnician: null,
      attachments: payload.files.map((file) => URL.createObjectURL(file)),
      comments: [],
    };

    const updatedTickets = [newTicket, ...tickets];
    saveTickets(updatedTickets);
    return newTicket;
  },

  async updateTicketStatus(ticketId: number, payload: UpdateStatusPayload) {
    const tickets = getTickets();
    const target = tickets.find((ticket) => ticket.id === ticketId);
    if (!target) {
      throw new Error("Ticket not found");
    }

    target.status = payload.status;
    target.updatedAt = new Date().toISOString();
    target.resolutionNotes = payload.resolutionNotes ?? target.resolutionNotes;
    target.rejectionReason = payload.rejectionReason ?? target.rejectionReason;
    saveTickets([...tickets]);
    return target;
  },

  async assignTechnician(ticketId: number, technicianId: number) {
    const tickets = getTickets();
    const target = tickets.find((ticket) => ticket.id === ticketId);
    const technician = getTechnicians().find((item) => item.id === technicianId);
    if (!target || !technician) {
      throw new Error("Assignment failed");
    }

    target.assignedTechnician = technician;
    target.updatedAt = new Date().toISOString();
    saveTickets([...tickets]);
    return target;
  },

  async addComment(ticketId: number, message: string) {
    const tickets = getTickets();
    const target = tickets.find((ticket) => ticket.id === ticketId);
    if (!target) {
      throw new Error("Ticket not found");
    }

    const currentUser = getCurrentUser();
    const comment: TicketComment = {
      id: nextId(tickets.flatMap((ticket) => ticket.comments.map((item) => item.id))),
      message,
      author: currentUser,
      timestamp: new Date().toISOString(),
      editable: true,
    };

    target.comments = [...target.comments, comment];
    target.updatedAt = new Date().toISOString();
    saveTickets([...tickets]);
    return comment;
  },

  async updateComment(commentId: number, message: string) {
    const tickets = getTickets();
    let updatedComment: TicketComment | null = null;

    tickets.forEach((ticket) => {
      ticket.comments = ticket.comments.map((comment) => {
        if (comment.id !== commentId) {
          return comment;
        }
        updatedComment = {
          ...comment,
          message,
          timestamp: new Date().toISOString(),
        };
        return updatedComment;
      });
    });

    saveTickets([...tickets]);

    if (!updatedComment) {
      throw new Error("Comment not found");
    }

    return updatedComment;
  },

  async deleteComment(commentId: number) {
    const tickets = getTickets().map((ticket) => ({
      ...ticket,
      comments: ticket.comments.filter((comment) => comment.id !== commentId),
    }));
    saveTickets(tickets);
  },

  async getTechnicians() {
    return getTechnicians();
  },

  async getNotifications() {
    return getNotifications();
  },
};
