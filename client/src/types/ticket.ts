export type Role = "USER" | "ADMIN" | "TECHNICIAN";
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH";
export type TicketStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "RESOLVED"
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
  editable: boolean;
}

export interface Ticket {
  id: number;
  title: string;
  category: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  preferredContactDetails: string;
  resolutionNotes: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: UserSummary;
  assignedTechnician: UserSummary | null;
  attachments: string[];
  comments: TicketComment[];
}

export interface Notification {
  id: number;
  type: "STATUS_CHANGED" | "COMMENT_ADDED";
  title: string;
  message: string;
  read: boolean;
  ticketId: number;
  createdAt: string;
}

export interface CreateTicketPayload {
  title: string;
  category: string;
  description: string;
  priority: TicketPriority;
  preferredContactDetails: string;
  files: File[];
}

export interface UpdateStatusPayload {
  status: TicketStatus;
  resolutionNotes?: string;
  rejectionReason?: string;
}
