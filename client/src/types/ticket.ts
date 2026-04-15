export type Role = "USER" | "ADMIN" | "TECHNICIAN";
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH";
export type TicketSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type TicketType = "MAINTENANCE" | "INCIDENT";
export type TicketStatus =
  | "OPEN"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "ON_HOLD"
  | "RESOLVED"
  | "REOPENED"
  | "CLOSED"
  | "REJECTED";

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

export interface ApiError {
  success: false;
  message: string;
  errors?: Record<string, string>;
  timestamp: string;
}

export interface UserSummary {
  id: number;
  fullName: string;
  email: string;
  role: Role;
}

export interface CurrentUser extends UserSummary {}

export interface TicketComment {
  id: number;
  message: string;
  author: UserSummary;
  timestamp: string;
  internalNote: boolean;
  editable: boolean;
}

export interface TicketActivity {
  id: number;
  action:
    | "TICKET_CREATED"
    | "TICKET_UPDATED"
    | "STATUS_CHANGED"
    | "TICKET_ASSIGNED"
    | "TICKET_REASSIGNED"
    | "COMMENT_ADDED"
    | "INTERNAL_NOTE_ADDED"
    | "COMMENT_UPDATED"
    | "COMMENT_DELETED"
    | "TICKET_ARCHIVED";
  message: string;
  fromStatus: TicketStatus | null;
  toStatus: TicketStatus | null;
  previousAssigneeName: string | null;
  newAssigneeName: string | null;
  internalOnly: boolean;
  actor: UserSummary;
  createdAt: string;
}

export interface Ticket {
  id: number;
  ticketNumber: string;
  title: string;
  type: TicketType;
  category: string;
  subcategory: string | null;
  description: string;
  priority: TicketPriority;
  severity: TicketSeverity;
  status: TicketStatus;
  preferredContactDetails: string;
  location: string | null;
  building: string | null;
  department: string | null;
  resolutionNotes: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  dueAt: string | null;
  archived: boolean;
  createdBy: UserSummary;
  assignedTechnician: UserSummary | null;
  attachments: string[];
  comments: TicketComment[];
  activity: TicketActivity[];
}

export interface Notification {
  id: number;
  type:
    | "TICKET_CREATED"
    | "TICKET_ASSIGNED"
    | "STATUS_CHANGED"
    | "COMMENT_ADDED"
    | "OVERDUE_ALERT"
    | "TICKET_RESOLVED"
    | "TICKET_CLOSED";
  title: string;
  message: string;
  read: boolean;
  ticketId: number;
  createdAt: string;
}

export interface CreateTicketPayload {
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
  files: File[];
}

export interface UpdateTicketPayload extends Omit<CreateTicketPayload, "files"> {}

export interface UpdateStatusPayload {
  status: TicketStatus;
  resolutionNotes?: string;
  rejectionReason?: string;
}

export interface CreateCommentPayload {
  message: string;
  internalNote?: boolean;
}

export interface TicketSummary {
  total: number;
  open: number;
  assigned: number;
  inProgress: number;
  overdue: number;
  resolved: number;
  closed: number;
}

export interface TicketAnalytics {
  monthlyCounts: Record<string, number>;
  typeBreakdown: Record<string, number>;
  categoryBreakdown: Record<string, number>;
  priorityBreakdown: Record<string, number>;
  statusBreakdown: Record<string, number>;
  averageResolutionHours: number;
  overdueCount: number;
  technicianWorkload: Record<string, number>;
}
