package com.server.server.ticketing.service;

import com.server.server.ticketing.dto.CreateTicketRequest;
import com.server.server.ticketing.dto.TicketDashboardResponse;
import com.server.server.ticketing.dto.TicketListResponse;
import com.server.server.ticketing.dto.TicketMetaResponse;
import com.server.server.ticketing.dto.TicketReportsResponse;
import com.server.server.ticketing.dto.UpdateTicketRequest;
import com.server.server.ticketing.entity.Ticket;
import com.server.server.ticketing.entity.TicketPriority;
import com.server.server.ticketing.entity.TicketStatus;
import com.server.server.ticketing.entity.TicketType;
import java.util.List;
import org.springframework.web.multipart.MultipartFile;

public interface TicketService {

    TicketMetaResponse getMeta();

    TicketListResponse getTickets(
            String userId,
            String search,
            TicketType type,
            TicketPriority priority,
            TicketStatus status,
            String category,
            String location,
            String assignedTechnicianId,
            boolean overdueOnly);

    Ticket getTicketById(String ticketId, String userId);

    Ticket createTicket(CreateTicketRequest request, String userId);

    Ticket updateTicket(String ticketId, UpdateTicketRequest request, String userId);

    Ticket assignTechnician(String ticketId, String technicianId, String userId);

    Ticket addComment(String ticketId, String message, String userId);

    Ticket addAttachments(String ticketId, List<MultipartFile> files, String userId);

    TicketDashboardResponse getDashboard(String userId);

    TicketReportsResponse getReports(String userId);
}
