package com.server.server.ticketing.dto;

import com.server.server.ticketing.entity.Ticket;
import com.server.server.ticketing.entity.TicketPriority;
import com.server.server.ticketing.entity.TicketStatus;
import com.server.server.ticketing.entity.TicketType;
import java.util.List;

public record TicketMetaResponse(
        List<TicketType> types,
        List<TicketPriority> priorities,
        List<TicketStatus> statuses,
        List<String> categories,
        List<Ticket.UserSummary> technicians) {
}
